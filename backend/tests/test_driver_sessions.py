import pytest
from fastapi.testclient import TestClient
from selamate_backend.main import app
from selamate_backend import driver_routes
from selamate_ai import fatigue


@pytest.fixture
def client():
    driver_routes._sessions.clear()
    with TestClient(app) as value:
        yield value
    driver_routes._sessions.clear()


def create(client):
    response = client.post('/api/driver/sessions')
    assert response.status_code == 200
    return response.json()['session_id']


def test_sessions_isolate_data_and_do_not_invent_fatigue(client):
    first, second = create(client), create(client)
    data = {'latitude': -6.2, 'longitude': 106.8, 'speed_source': 'gps',
            'behavior': {'speed': 90, 'speed_limit': 60},
            'environment': {'rainfall': 0, 'visibility': 1000, 'road_condition': 'dry', 'slope': 0, 'disaster_risk': 0}}
    response = client.post(f'/api/driver/sessions/{first}/telemetry', json=data)
    assert response.status_code == 200
    assert response.json()['behavior']['behavior_score'] == 40
    assert response.json()['fatigue'] is None
    assert response.json()['risk'] is None
    assert client.get(f'/api/driver/sessions/{second}').json()['telemetry'] is None
    assert client.post(f'/api/driver/sessions/{first}/stop').status_code == 200
    assert client.get(f'/api/driver/sessions/{first}').status_code == 404


def test_stale_components_do_not_fuse(client):
    from time import monotonic
    session_id = create(client)
    session = driver_routes._sessions[session_id]
    session.fatigue_result = {'fatigue_status': 'ALERT', 'fatigue_score': 0}
    session.behavior_result = {'behavior_score': 0}
    session.environment_result = {'environment_score': 0}
    session.frame_received = monotonic() - 20
    session.telemetry_received = monotonic()
    assert client.get(f'/api/driver/sessions/{session_id}').json()['risk'] is None
    session.frame_received = monotonic()
    assert client.get(f'/api/driver/sessions/{session_id}').json()['risk']['overall_risk_score'] == 0


def test_invalid_telemetry(client):
    session_id = create(client)
    assert client.post(f'/api/driver/sessions/{session_id}/telemetry', json={'latitude': 100}).status_code == 422
    assert client.post(f'/api/driver/sessions/{session_id}/telemetry', json={'behavior': {'speed': 1e308, 'speed_limit': 1e-308}}).status_code == 422
    assert client.post('/api/behavior', json={'speed': 1e308, 'speed_limit': 1e-308}).status_code == 422


def test_frame_validation_and_no_model(client, monkeypatch, tmp_path):
    cv2 = pytest.importorskip('cv2')
    np = pytest.importorskip('numpy')
    session_id = create(client)
    path = f'/api/driver/sessions/{session_id}/frame'
    assert client.post(path, data={'timestamp': '1'}, files={'file': ('frame.jpg', b'bad', 'image/jpeg')}).status_code == 422
    assert client.post(path, data={'timestamp': '1'}, files={'file': ('frame.jpg', b'x' * (512 * 1024 + 1), 'image/jpeg')}).status_code == 413
    monkeypatch.setattr(fatigue, 'MODEL_PATH', tmp_path / 'eye_detector.pt')
    monkeypatch.setattr(fatigue, '_model', None)
    success, image = cv2.imencode('.jpg', np.zeros((32, 32, 3), dtype=np.uint8))
    assert success
    response = client.post(path, data={'timestamp': '1'}, files={'file': ('frame.jpg', image.tobytes(), 'image/jpeg')})
    assert response.status_code == 503
    assert 'Eye detector model missing' in response.json()['detail']
    assert not driver_routes._sessions[session_id].observations


def test_session_expiry_and_capacity(client, monkeypatch):
    session_id = create(client)
    driver_routes._sessions[session_id].touched -= driver_routes.SESSION_TTL + 1
    assert client.get(f'/api/driver/sessions/{session_id}').status_code == 404
    for index in range(128):
        driver_routes._sessions[str(index)] = driver_routes.DriverSession()
    assert client.post('/api/driver/sessions').status_code == 503
