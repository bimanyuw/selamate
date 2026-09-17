"""Single-process demo sessions; image inference remains in selamate_ai."""
from collections import deque
from io import BytesIO
from typing import Literal
from dataclasses import dataclass, field
import logging
import math
from threading import Lock
from time import monotonic, time
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from pydantic import Field
from selamate_ai import behavior, environment, fatigue, fusion
from .schemas import AIRequest, BehaviorRequest, EnvironmentRequest
from .auth import get_current_user, admin_user
from .models import User

router = APIRouter(prefix="/driver/sessions", tags=["Driver realtime"], dependencies=[Depends(get_current_user)])


class TelemetryRequest(AIRequest):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    speed_source: str | None = Field(default=None, pattern="^(gps|obd)$")
    rpm: float | None = Field(default=None, ge=0, le=20000)
    behavior: BehaviorRequest | None = None
    environment: EnvironmentRequest | None = None


class NotificationRequest(AIRequest):
    message: str = Field(min_length=1, max_length=500)
    kind: Literal['text', 'ringtone'] = 'text'


class AudioRequest(AIRequest):
    enabled: bool


class AlarmStateRequest(AIRequest):
    state: Literal['ringing', 'acknowledged']


@dataclass
class DriverSession:
    owner_id: str = ""
    owner_name: str = ""
    touched: float = field(default_factory=monotonic)
    lock: Lock = field(default_factory=Lock)
    observations: deque = field(default_factory=lambda: deque(maxlen=300))
    telemetry: dict | None = None
    fatigue_result: dict | None = None
    frame_received: float | None = None
    telemetry_received: float | None = None
    behavior_result: dict | None = None
    environment_result: dict | None = None
    notifications: deque = field(default_factory=lambda: deque(maxlen=50))
    camera_bytes: bytes | None = None
    camera_content_type: str = "image/jpeg"
    camera_received: float | None = None
    camera_version: int = 0
    audio_ready: bool = False


_sessions: dict[str, DriverSession] = {}
_sessions_lock = Lock()
SESSION_TTL = 15 * 60


def _prune():
    now = monotonic()
    for key in list(_sessions):
        if now - _sessions[key].touched > SESSION_TTL:
            del _sessions[key]


def _session(session_id, owner_id=None):
    with _sessions_lock:
        _prune()
        session = _sessions.get(session_id)
        if session is None:
            raise HTTPException(404, "Sesi tidak ditemukan atau sudah kedaluwarsa")
        if owner_id is not None and session.owner_id != owner_id:
            raise HTTPException(403, "Sesi pengemudi milik pengguna lain")
        session.touched = monotonic()
        return session


def _snapshot(session, include_notifications=False):
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
            "risk": combined, "frame_age_seconds": frame_age, "telemetry_age_seconds": telemetry_age,
            "notifications": list(session.notifications) if include_notifications else [],
            "audio_ready": session.audio_ready,
            "camera_version": session.camera_version,
            "camera_age_seconds": now - session.camera_received if session.camera_received is not None else None}


@router.post("")
def create_session(user: User = Depends(get_current_user)):
    with _sessions_lock:
        _prune()
        if len(_sessions) >= 128:
            raise HTTPException(503, "Kapasitas sesi penuh; hentikan sesi yang tidak digunakan")
        session_id = str(uuid4())
        _sessions[session_id] = DriverSession(owner_id=user.id, owner_name=user.name)
    return {"session_id": session_id, "expires_after_idle_seconds": SESSION_TTL}


@router.get("")
def active_sessions(admin: User = Depends(admin_user)):
    with _sessions_lock:
        _prune()
        items = list(_sessions.items())
    result = []
    for session_id, session in items:
        with session.lock:
            age = monotonic() - session.camera_received if session.camera_received is not None else None
            result.append({"session_id": session_id, "driver_name": session.owner_name,
                           "camera_active": age is not None and age <= 5,
                           "latitude": (session.telemetry or {}).get("latitude"),
                           "longitude": (session.telemetry or {}).get("longitude"),
                           "telemetry_age_seconds": None if session.telemetry_received is None else max(0, monotonic() - session.telemetry_received),
                           "fatigue_status": session.fatigue_result["fatigue_status"] if session.fatigue_result else None})
    return {"sessions": result}


@router.get("/{session_id}/camera")
def camera_preview(session_id: str, user: User = Depends(get_current_user)):
    session = _session(session_id)
    if user.id != session.owner_id and getattr(user, "role", "Driver") != "Admin":
        raise HTTPException(403, "Kamera hanya dapat dilihat oleh pemilik sesi dan Admin")
    with session.lock:
        if session.camera_bytes is None:
            raise HTTPException(404, "Menunggu kamera pengemudi")
        return Response(content=session.camera_bytes, media_type=session.camera_content_type,
                        headers={"Cache-Control": "no-store"})


@router.post("/{session_id}/camera")
def publish_camera(session_id: str, file: UploadFile, user: User = Depends(get_current_user)):
    try:
        session = _session(session_id, user.id)
        if file.content_type not in {"image/jpeg", "image/png"}:
            raise HTTPException(422, "Frame harus JPEG atau PNG")
        data = file.file.read(512 * 1024 + 1)
        if len(data) > 512 * 1024:
            raise HTTPException(413, "Frame maksimal 512 KiB")
        try:
            with Image.open(BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG"} or max(image.size) > 2048:
                    raise HTTPException(422, "Frame harus JPEG/PNG dengan dimensi maksimal 2048 piksel")
                content_type = "image/jpeg" if image.format == "JPEG" else "image/png"
                image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError) as exc:
            raise HTTPException(422, "Frame tidak dapat dibaca") from exc
        with session.lock:
            session.camera_bytes = data
            session.camera_content_type = content_type
            session.camera_received = monotonic()
            session.camera_version += 1
        return {"camera_version": session.camera_version}
    finally:
        file.file.close()


@router.get("/{session_id}")
def session_snapshot(session_id: str, user: User = Depends(get_current_user)):
    session = _session(session_id)
    with session.lock:
        return _snapshot(session, user.id == session.owner_id or getattr(user, "role", "Driver") == "Admin")


@router.post("/{session_id}/notifications", status_code=201)
def notify_driver(session_id: str, payload: NotificationRequest, admin: User = Depends(admin_user)):
    message = payload.message.strip()
    if not message:
        raise HTTPException(422, "Pesan wajib diisi")
    session = _session(session_id)
    created = time()
    notification = {"id": str(uuid4()), "message": message, "sender": admin.name, "created_at": created,
                    "kind": payload.kind, "expires_at": created + 30 if payload.kind == 'ringtone' else None,
                    "state": 'pending' if payload.kind == 'ringtone' else None}
    with session.lock:
        session.notifications.append(notification)
    return notification


@router.post("/{session_id}/audio")
def set_driver_audio(session_id: str, payload: AudioRequest, user: User = Depends(get_current_user)):
    session = _session(session_id, user.id)
    with session.lock:
        session.audio_ready = payload.enabled
    return {"audio_ready": payload.enabled}


@router.post("/{session_id}/notifications/{notification_id}/state")
def alarm_state(session_id: str, notification_id: str, payload: AlarmStateRequest, user: User = Depends(get_current_user)):
    session = _session(session_id, user.id)
    with session.lock:
        notification = next((note for note in session.notifications if note['id'] == notification_id), None)
        if notification is None or notification['kind'] != 'ringtone':
            raise HTTPException(404, "Alarm tidak ditemukan")
        if notification['state'] == 'acknowledged':
            return notification
        if payload.state == 'ringing' and notification['expires_at'] <= time():
            raise HTTPException(409, "Alarm sudah kedaluwarsa")
        notification['state'] = payload.state
        return notification


@router.post("/{session_id}/stop")
def stop_session(session_id: str, user: User = Depends(get_current_user)):
    with _sessions_lock:
        existing = _sessions.get(session_id)
        if existing and existing.owner_id != user.id:
            raise HTTPException(403, "Sesi pengemudi milik pengguna lain")
        _sessions.pop(session_id, None)
    return {"status": "stopped"}


@router.post("/{session_id}/telemetry")
def update_telemetry(session_id: str, payload: TelemetryRequest, user: User = Depends(get_current_user)):
    session = _session(session_id, user.id)
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
        return _snapshot(session, True)


@router.post("/{session_id}/frame")
def update_frame(session_id: str, file: UploadFile, timestamp: float = Form(ge=0), user: User = Depends(get_current_user)):
    try:
        if not math.isfinite(timestamp):
            raise HTTPException(422, "Timestamp harus berupa detik yang valid")
        session = _session(session_id, user.id)
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
            return _snapshot(session, True)
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
