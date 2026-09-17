"""Single-process demo sessions; image inference remains in selamate_ai."""
from collections import deque
from dataclasses import dataclass, field
import logging
import math
from threading import Lock
from time import monotonic
from uuid import uuid4

from fastapi import APIRouter, Form, HTTPException, UploadFile
from pydantic import Field
from selamate_ai import behavior, environment, fatigue, fusion
from .schemas import AIRequest, BehaviorRequest, EnvironmentRequest

router = APIRouter(prefix="/driver/sessions", tags=["Driver realtime"])


class TelemetryRequest(AIRequest):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    speed_source: str | None = Field(default=None, pattern="^(gps|obd)$")
    rpm: float | None = Field(default=None, ge=0, le=20000)
    behavior: BehaviorRequest | None = None
    environment: EnvironmentRequest | None = None


@dataclass
class DriverSession:
    touched: float = field(default_factory=monotonic)
    lock: Lock = field(default_factory=Lock)
    observations: deque = field(default_factory=lambda: deque(maxlen=300))
    telemetry: dict | None = None
    fatigue_result: dict | None = None
    frame_received: float | None = None
    telemetry_received: float | None = None
    behavior_result: dict | None = None
    environment_result: dict | None = None


_sessions: dict[str, DriverSession] = {}
_sessions_lock = Lock()
SESSION_TTL = 15 * 60


def _prune():
    now = monotonic()
    for key in list(_sessions):
        if now - _sessions[key].touched > SESSION_TTL:
            del _sessions[key]


def _session(session_id):
    with _sessions_lock:
        _prune()
        session = _sessions.get(session_id)
        if session is None:
            raise HTTPException(404, "Sesi tidak ditemukan atau sudah kedaluwarsa")
        session.touched = monotonic()
        return session


def _snapshot(session):
    now = monotonic()
    frame_age = now - session.frame_received if session.frame_received is not None else None
    telemetry_age = now - session.telemetry_received if session.telemetry_received is not None else None
    combined = None
    if (session.fatigue_result and session.fatigue_result["fatigue_status"] != "INSUFFICIENT_DATA"
            and session.behavior_result and session.environment_result
            and frame_age is not None and frame_age <= 5 and telemetry_age is not None and telemetry_age <= 5):
        combined = fusion.fuse_risk(session.fatigue_result["fatigue_score"], session.behavior_result["behavior_score"], session.environment_result["environment_score"])
    return {"telemetry": session.telemetry, "fatigue": session.fatigue_result,
            "behavior": session.behavior_result, "environment": session.environment_result,
            "risk": combined, "frame_age_seconds": frame_age, "telemetry_age_seconds": telemetry_age}


@router.post("")
def create_session():
    with _sessions_lock:
        _prune()
        if len(_sessions) >= 128:
            raise HTTPException(503, "Kapasitas sesi penuh; hentikan sesi yang tidak digunakan")
        session_id = str(uuid4())
        _sessions[session_id] = DriverSession()
    return {"session_id": session_id, "expires_after_idle_seconds": SESSION_TTL}


@router.get("/{session_id}")
def session_snapshot(session_id: str):
    session = _session(session_id)
    with session.lock:
        return _snapshot(session)


@router.post("/{session_id}/stop")
def stop_session(session_id: str):
    with _sessions_lock:
        _sessions.pop(session_id, None)
    return {"status": "stopped"}


@router.post("/{session_id}/telemetry")
def update_telemetry(session_id: str, payload: TelemetryRequest):
    session = _session(session_id)
    try:
        behavior_result = behavior.score_behavior(**payload.behavior.model_dump()) if payload.behavior else None
        environment_result = environment.score_environment(**payload.environment.model_dump()) if payload.environment else None
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    with session.lock:
        session.telemetry = payload.model_dump()
        session.behavior_result = behavior_result
        session.environment_result = environment_result
        session.telemetry_received = monotonic()
        return _snapshot(session)


@router.post("/{session_id}/frame")
def update_frame(session_id: str, file: UploadFile, timestamp: float = Form(ge=0)):
    try:
        if not math.isfinite(timestamp):
            raise HTTPException(422, "Timestamp harus berupa detik yang valid")
        session = _session(session_id)
        if file.content_type not in {"image/jpeg", "image/png"}:
            raise HTTPException(422, "Frame harus JPEG atau PNG")
        data = file.file.read(512 * 1024 + 1)
        if len(data) > 512 * 1024:
            raise HTTPException(413, "Frame maksimal 512 KiB")
        with session.lock:
            if session.observations and timestamp <= session.observations[-1][0]:
                raise HTTPException(422, "Timestamp frame harus meningkat")
            state = fatigue.detect_image_bytes(data)
            session.observations.append((timestamp, state))
            while len(session.observations) > 1 and session.observations[0][0] < timestamp - 60:
                session.observations.popleft()
            result = fatigue.analyze_fatigue(session.observations, max_observation_gap=1.5)
            if timestamp - session.observations[0][0] < 5:
                result["fatigue_status"] = "INSUFFICIENT_DATA"
            session.fatigue_result = {**result, "eye_state": state}
            session.frame_received = monotonic()
            return _snapshot(session)
    except HTTPException:
        raise
    except (FileNotFoundError, ImportError, fatigue.EyeModelError) as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        logging.getLogger(__name__).exception("Realtime frame processing failed")
        raise HTTPException(500, "Analisis frame gagal; periksa log backend") from exc
    finally:
        file.file.close()
