from types import SimpleNamespace
from time import monotonic
from fastapi.testclient import TestClient
from selamate_backend.main import app
from selamate_backend.auth import get_current_user
from selamate_backend import driver_routes


def test_admin_presence_tracks_selected_session_and_expires():
    driver_routes._sessions.clear()
    identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
    app.dependency_overrides[get_current_user] = lambda: identity
    try:
        with TestClient(app) as client:
            first = client.post('/api/driver/sessions').json()['session_id']
            second = client.post('/api/driver/sessions').json()['session_id']
            assert client.get(f'/api/driver/sessions/{first}').json()['admin_monitoring'] is False
            identity = SimpleNamespace(id='admin', name='Admin', role='Admin')
            client.get('/api/driver/sessions')
            assert driver_routes._sessions[first].admin_seen is None
            assert client.get(f'/api/driver/sessions/{first}').json()['admin_monitoring'] is True
            identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
            assert client.get(f'/api/driver/sessions/{first}').json()['admin_monitoring'] is True
            assert client.get(f'/api/driver/sessions/{second}').json()['admin_monitoring'] is False
            driver_routes._sessions[first].admin_seen = monotonic() - 9
            assert client.get(f'/api/driver/sessions/{first}').json()['admin_monitoring'] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        driver_routes._sessions.clear()
