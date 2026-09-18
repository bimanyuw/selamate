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


def test_yawning_from_frames_drives_fatigue_and_journey_score(client, monkeypatch):
    from selamate_ai import yawning
    from selamate_backend.config import settings
    cv2 = pytest.importorskip('cv2')
    np = pytest.importorskip('numpy')
    monkeypatch.setattr(settings, 'data_source', 'simulation')
    monkeypatch.setattr(fatigue, 'detect_image_bytes', lambda _: 'OPEN')
    mouth = {'mouth_state': 'CLOSED', 'jaw_open': .1, 'status': 'READY'}
    monkeypatch.setattr(yawning, 'detect_image_bytes', lambda _: dict(mouth))
    _, image = cv2.imencode('.jpg', np.zeros((32, 32, 3), dtype=np.uint8))
    sid = create(client)
    def frame(timestamp):
        response = client.post(f'/api/driver/sessions/{sid}/frame', data={'timestamp': str(timestamp)},
                               files={'file': ('frame.jpg', image.tobytes(), 'image/jpeg')})
        assert response.status_code == 200
        return response.json()['fatigue']
    for timestamp in range(7):
        result = frame(timestamp)
    assert result['fatigue_status'] == 'ALERT'
    mouth.update(mouth_state='OPEN', jaw_open=.9)
    for timestamp in range(7, 11):
        result = frame(timestamp)
    assert result['eye_state'] == 'OPEN'
    assert result['eye_fatigue_score'] == 0
    assert result['yawn_count'] == 1
    assert result['fatigue_status'] == 'FATIGUED'
    risk = client.post('/api/journey-risk', json={'session_id': sid, 'fuel_level': 23}).json()
    assert risk['risk_level'] == 'HIGH'
    assert risk['components']['fatigue']['score'] == 70


def test_invalid_telemetry(client):
    session_id = create(client)
    assert client.post(f'/api/driver/sessions/{session_id}/telemetry', json={'latitude': 100}).status_code == 422
    assert client.post(f'/api/driver/sessions/{session_id}/telemetry', json={'behavior': {'speed': 1e308, 'speed_limit': 1e-308}}).status_code == 422
    assert client.post('/api/behavior', json={'speed': 1e308, 'speed_limit': 1e-308}).status_code == 422


def test_live_camera_warmup_face_confirmation_and_fast_recovery(client, monkeypatch):
    from selamate_ai import yawning
    from selamate_backend.config import settings
    monkeypatch.setattr(settings, 'data_source', 'simulation')
    monkeypatch.setattr(fatigue, 'detect_image_bytes', lambda _: 'CLOSED')
    face = {'mouth_state': 'CLOSED', 'jaw_open': .1, 'status': 'READY', 'landmark_eye_state': 'OPEN'}
    monkeypatch.setattr(yawning, 'detect_image_bytes', lambda _: dict(face))
    sid = create(client)
    def frame(timestamp):
        response = client.post(f'/api/driver/sessions/{sid}/frame', data={'timestamp': str(timestamp)},
                               files={'file': ('frame.jpg', b'mocked-detectors', 'image/jpeg')})
        assert response.status_code == 200
        return response.json()
    for timestamp in range(6):
        snapshot = frame(timestamp)
        assert snapshot['fatigue']['eye_state'] == 'OPEN'
        if timestamp < 5:
            assert snapshot['fatigue']['fatigue_score'] is None
    assert snapshot['fatigue']['fatigue_status'] == 'ALERT'
    assert snapshot['fatigue']['fatigue_score'] == 0
    assert snapshot['session_duration_seconds'] < 10  # Never the dummy 8200 seconds.
    face['landmark_eye_state'] = 'CLOSED'
    for timestamp in range(6, 10):
        snapshot = frame(timestamp)
    assert snapshot['fatigue']['fatigue_status'] == 'FATIGUED'
    face['landmark_eye_state'] = 'OPEN'
    for timestamp in range(10, 13):
        snapshot = frame(timestamp)
    assert snapshot['fatigue']['fatigue_score'] == 0
    assert snapshot['fatigue']['fatigue_status'] == 'ALERT'
    risk = client.post('/api/journey-risk', json={'session_id': sid, 'fuel_level': 23}).json()
    assert risk['overall_risk_score'] == 40  # Vehicle warning remains independent.
    face.update(status='NO_FACE', mouth_state='UNKNOWN')
    monkeypatch.setattr(fatigue, 'detect_image_bytes', lambda _: 'UNKNOWN')
    snapshot = frame(13)
    assert snapshot['fatigue']['fatigue_status'] == 'INSUFFICIENT_DATA'


def test_closed_eye_detection_survives_missing_mouth_and_ambiguous_landmarks(client, monkeypatch):
    from selamate_ai import yawning
    monkeypatch.setattr(fatigue, 'detect_image_bytes', lambda _: 'CLOSED')
    monkeypatch.setattr(yawning, 'detect_image_bytes', lambda _: {
        'mouth_state': 'UNKNOWN', 'jaw_open': None, 'status': 'READY', 'landmark_eye_state': 'UNKNOWN',
    })
    sid = create(client)
    for timestamp in range(6):
        response = client.post(f'/api/driver/sessions/{sid}/frame', data={'timestamp': str(timestamp)},
                               files={'file': ('frame.jpg', b'mocked-detectors', 'image/jpeg')})
        assert response.status_code == 200
        result = response.json()['fatigue']
        assert result['eye_state'] == 'CLOSED'
    assert result['fatigue_status'] == 'FATIGUED'
    assert result['fatigue_score'] >= 70
    assert result['mouth_state'] == 'UNKNOWN'


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
