import json
import logging
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from selamate_ai.registry import get_status
from .config import ROOT, settings
from .database import get_session
from .models import Alert
from .schemas import AlertResponse, AlertsResponse

app = FastAPI(title="Selamate EWS API", version="0.2.0")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "selamate-backend", "data_source": settings.data_source}


@app.get("/api/health/database")
def database_health(session: Annotated[Session, Depends(get_session)]):
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database belum tersedia")
    return {"status": "ok", "service": "postgresql"}


@app.get("/api/alerts", response_model=AlertsResponse)
def alerts(session: Annotated[Session, Depends(get_session)]):
    if settings.data_source == "simulation":
        rows = json.loads((ROOT / "data/samples/alerts.json").read_text(encoding="utf-8"))
        return AlertsResponse(source="simulation", alerts=[AlertResponse.model_validate(row) for row in rows])
    try:
        rows = session.scalars(select(Alert).order_by(Alert.id)).all()
        return AlertsResponse(source="database", alerts=[AlertResponse.model_validate(row) for row in rows])
    except SQLAlchemyError:
        logging.getLogger(__name__).exception("Database query failed")
        raise HTTPException(status_code=503, detail="Database belum siap. Jalankan migrasi dahulu.")


@app.get("/api/ai/status")
def ai_status():
    return get_status()
