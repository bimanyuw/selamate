"""HTTP validation and upload lifecycle; scoring belongs to selamate_ai."""
import logging
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import APIRouter, HTTPException, UploadFile
from selamate_ai import behavior, environment, fatigue, fusion

from .config import settings
from .schemas import BehaviorRequest, EnvironmentRequest, RiskRequest

router = APIRouter(tags=["AI"])
logger = logging.getLogger(__name__)


@router.post("/behavior")
def behavior_risk(payload: BehaviorRequest):
    try:
        return behavior.score_behavior(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/environment")
def environment_risk(payload: EnvironmentRequest):
    try:
        return environment.score_environment(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/risk")
def overall_risk(payload: RiskRequest):
    try:
        return fusion.fuse_risk(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/fatigue")
def video_fatigue(file: UploadFile):
    """Multipart field `file`; blocking inference runs in FastAPI's thread pool."""
    try:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in {".mp4", ".avi", ".mov", ".webm", ".mkv", ".m4v"}:
            raise HTTPException(status_code=422, detail="Upload a video file: MP4, AVI, MOV, WebM, MKV, or M4V")
        content_type = (file.content_type or "application/octet-stream").split(";", 1)[0].lower()
        if not content_type.startswith("video/") and content_type != "application/octet-stream":
            raise HTTPException(status_code=422, detail="The upload must have a video content type")
        with TemporaryDirectory(prefix="selamate-fatigue-") as directory:
            path = Path(directory) / f"video{suffix}"
            size = 0
            with path.open("wb") as target:
                while chunk := file.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > settings.fatigue_max_upload_bytes:
                        raise HTTPException(status_code=413, detail=f"Video exceeds the {settings.fatigue_max_upload_bytes}-byte upload limit")
                    target.write(chunk)
            if size == 0:
                raise HTTPException(status_code=422, detail="Video upload is empty")
            return fatigue.analyze_video(path, max_duration_seconds=settings.fatigue_max_video_seconds)
    except HTTPException:
        raise
    except (FileNotFoundError, ImportError, fatigue.EyeModelError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Fatigue video processing failed")
        raise HTTPException(status_code=500, detail="Video processing failed. Check backend logs.") from exc
    finally:
        file.file.close()
