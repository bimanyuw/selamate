"""Algorithmic journey score with authoritative live camera evidence."""
import json
import logging
from time import monotonic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from selamate_ai.journey import score_journey, include_fatigue
from .auth import get_current_user
from .config import ROOT, settings
from .database import get_session
from .driver_routes import TelemetryRequest, _session
from .models import Alert
from .schemas import AlertResponse

router = APIRouter(tags=["Journey algorithm"], dependencies=[Depends(get_current_user)])


class JourneyRequest(TelemetryRequest):
    session_id: str | None = Field(default=None, min_length=1, max_length=36)


@router.post("/journey-risk")
def journey_risk(payload: JourneyRequest, session: Session = Depends(get_session), user=Depends(get_current_user)):
    fatigue_score = None
    if payload.session_id is not None:
        driver = _session(payload.session_id, None if getattr(user, "role", "Driver") == "Admin" else user.id)
        with driver.lock:
            fatigue = driver.fatigue_result
            fresh = driver.frame_received is not None and monotonic() - driver.frame_received <= 5
            if fresh and fatigue and fatigue.get("fatigue_status") in {"ALERT", "DROWSY", "FATIGUED"}:
                fatigue_score = fatigue.get("fatigue_score")
    if settings.data_source == "simulation":
        hazards = json.loads((ROOT / "data/samples/alerts.json").read_text(encoding="utf-8"))
    else:
        try:
            hazards = [AlertResponse.model_validate(row).model_dump() for row in session.scalars(select(Alert)).all()]
        except SQLAlchemyError:
            logging.getLogger(__name__).exception("Hazard lookup unavailable")
            hazards = None
    try:
        result = score_journey(payload.model_dump(), hazards)
        if payload.session_id is not None:
            result = include_fatigue(result, fatigue_score)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    result["hazard_data_available"] = hazards is not None
    return result
