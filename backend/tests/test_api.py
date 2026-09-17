import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from selamate_backend.main import app
from selamate_backend.config import settings
from selamate_backend.database import Base, get_session
from selamate_backend.models import Alert


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "data_source", "simulation")
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


def test_simulation_contract(client):
    assert client.get("/api/health").json()["status"] == "ok"
    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "simulation"
    assert len(data["alerts"]) == 3
    assert all(row["is_simulation"] for row in data["alerts"])
    assert all(-90 <= row["latitude"] <= 90 for row in data["alerts"])
    assert client.post("/api/alerts").status_code == 405
    assert client.get("/missing").status_code == 404


def test_ai_has_no_active_predictions(client):
    assert client.get("/api/ai/status").json()["status"] == "not_implemented"


def test_database_mode_reads_persisted_rows(client, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Alert(id="test", region="Test", hazard="Banjir", level="Siaga", description="Fixture", latitude=-6, longitude=107, is_simulation=True))
        session.commit()

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    monkeypatch.setattr(settings, "data_source", "database")
    try:
        response = client.get("/api/alerts")
        assert response.status_code == 200
        assert response.json()["source"] == "database"
        assert response.json()["alerts"][0]["id"] == "test"
        assert client.get("/api/health/database").status_code == 200
    finally:
        engine.dispose()


def test_database_failure_is_not_silent_simulation(client, monkeypatch):
    class UnavailableSession:
        def scalars(self, *args):
            raise OperationalError("SELECT", {}, Exception("offline"))

        def execute(self, *args):
            raise OperationalError("SELECT", {}, Exception("offline"))

    app.dependency_overrides[get_session] = lambda: UnavailableSession()
    monkeypatch.setattr(settings, "data_source", "database")
    assert client.get("/api/alerts").status_code == 503
    assert client.get("/api/health/database").status_code == 503
