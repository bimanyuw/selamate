from fastapi.testclient import TestClient
from selamate_backend.main import app
from selamate_backend.config import settings


def test_journey_score_without_camera_and_validation(monkeypatch):
    monkeypatch.setattr(settings, 'data_source', 'simulation')
    with TestClient(app) as client:
        response = client.post('/api/journey-risk', json={
            'behavior': {'speed': 80, 'speed_limit': 60},
            'fuel_level': 70, 'engine_temperature': 90,
            'environment': {'rainfall': 0, 'visibility': 2000, 'road_condition': 'dry', 'slope': 0, 'disaster_risk': 0},
        })
        assert response.status_code == 200
        risk = response.json()
        assert risk['risk_level'] == 'HIGH'
        assert risk['method'] == 'algorithm'
        assert 'gps' in risk['missing_components']
        assert client.post('/api/journey-risk', json={'fuel_level': 101}).status_code == 422
        assert client.post('/api/journey-risk', json={'engine_temperature': 201}).status_code == 422
        assert client.post('/api/journey-risk', json={}).json()['overall_risk_score'] is None


def test_gps_matches_sample_hazard(monkeypatch):
    monkeypatch.setattr(settings, 'data_source', 'simulation')
    with TestClient(app) as client:
        response = client.post('/api/journey-risk', json={'latitude': -6.2088, 'longitude': 106.8456, 'accuracy': 10})
        assert response.status_code == 200
        risk = response.json()
        assert risk['nearby_hazards'][0]['id'] == 'demo-001'
        assert risk['nearby_hazards'][0]['is_simulation'] is True
        assert risk['coverage'] == 15


def test_live_fatigue_changes_score_and_stale_camera_is_missing(monkeypatch):
    from time import monotonic
    from selamate_backend import driver_routes

    monkeypatch.setattr(settings, 'data_source', 'simulation')
    with TestClient(app) as client:
        sid = client.post('/api/driver/sessions').json()['session_id']
        driver = driver_routes._sessions[sid]
        try:
            payload = {'session_id': sid, 'fuel_level': 23}
            scores = []
            for value, status in [(0, 'ALERT'), (20, 'ALERT'), (50, 'DROWSY'), (80, 'FATIGUED')]:
                driver.frame_received = monotonic()
                driver.fatigue_result = {'fatigue_score': value, 'fatigue_status': status}
                response = client.post('/api/journey-risk', json=payload)
                assert response.status_code == 200
                result = response.json()
                scores.append(result['overall_risk_score'])
                assert result['components']['fatigue']['score'] == value
                assert 'fatigue' not in result['missing_components']
            assert scores == [40, 52, 70, 88]
            assert result['risk_level'] == 'HIGH'
            driver.frame_received = monotonic() - 6
            stale = client.post('/api/journey-risk', json=payload).json()
            assert stale['overall_risk_score'] == 40
            assert 'fatigue' in stale['missing_components']
            assert stale['coverage'] < result['coverage']
            driver.frame_received = monotonic()
            driver.fatigue_result['fatigue_status'] = 'INSUFFICIENT_DATA'
            missing = client.post('/api/journey-risk', json=payload).json()
            assert 'fatigue' in missing['missing_components']
            assert 'fatigue' not in missing['components']
            assert client.post('/api/journey-risk', json={**payload, 'fatigue_score': 100}).status_code == 422
        finally:
            driver_routes._sessions.pop(sid, None)


def test_camera_score_is_accessible_only_to_owner_or_admin(monkeypatch):
    from types import SimpleNamespace
    from selamate_backend.auth import get_current_user
    from selamate_backend import driver_routes

    monkeypatch.setattr(settings, 'data_source', 'simulation')
    identity = SimpleNamespace(id='owner', name='Owner', role='Driver')
    app.dependency_overrides[get_current_user] = lambda: identity
    with TestClient(app) as client:
        sid = client.post('/api/driver/sessions').json()['session_id']
        try:
            identity = SimpleNamespace(id='other', name='Other', role='Driver')
            assert client.post('/api/journey-risk', json={'session_id': sid}).status_code == 403
            identity = SimpleNamespace(id='admin', name='Admin', role='Admin')
            assert client.post('/api/journey-risk', json={'session_id': sid}).status_code == 200
        finally:
            driver_routes._sessions.pop(sid, None)
