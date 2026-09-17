from types import SimpleNamespace
from fastapi.testclient import TestClient
from selamate_backend.main import app
from selamate_backend.auth import get_current_user
from selamate_backend import driver_routes
from time import time


def test_admin_notifications_authorization_delivery_and_isolation():
    driver_routes._sessions.clear()
    identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
    app.dependency_overrides[get_current_user] = lambda: identity
    try:
        with TestClient(app) as client:
            first = client.post('/api/driver/sessions').json()['session_id']
            second = client.post('/api/driver/sessions').json()['session_id']
            endpoint = f'/api/driver/sessions/{first}/notifications'
            assert client.post(endpoint, json={'message': 'Istirahat'}).status_code == 403
            identity = SimpleNamespace(id='admin', name='Operator', role='Admin')
            assert client.post(endpoint, json={'message': '   '}).status_code == 422
            assert client.post(endpoint, json={'message': 'x' * 501}).status_code == 422
            response = client.post(endpoint, json={'message': ' Berhenti di tempat aman. '})
            assert response.status_code == 201
            assert response.json()['sender'] == 'Operator'
            identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
            notes = client.get(f'/api/driver/sessions/{first}').json()['notifications']
            assert len(notes) == 1
            assert notes[0]['message'] == 'Berhenti di tempat aman.'
            assert client.get(f'/api/driver/sessions/{second}').json()['notifications'] == []
            identity = SimpleNamespace(id='other', name='Other', role='Driver')
            assert client.get(f'/api/driver/sessions/{first}').json()['notifications'] == []
            identity = SimpleNamespace(id='admin', name='Operator', role='Admin')
            assert client.post('/api/driver/sessions/missing/notifications', json={'message': 'Hello'}).status_code == 404
            for i in range(55):
                assert client.post(endpoint, json={'message': str(i)}).status_code == 201
            assert len(client.get(f'/api/driver/sessions/{first}').json()['notifications']) == 50
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        driver_routes._sessions.clear()


def test_ringtone_delivery_audio_readiness_acknowledgement_and_expiry():
    driver_routes._sessions.clear()
    identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
    app.dependency_overrides[get_current_user] = lambda: identity
    try:
        with TestClient(app) as client:
            session_id = client.post('/api/driver/sessions').json()['session_id']
            base = f'/api/driver/sessions/{session_id}'
            assert client.post(base + '/audio', json={'enabled': True}).json()['audio_ready'] is True
            assert client.post(base + '/notifications', json={'message': 'Bangun', 'kind': 'ringtone'}).status_code == 403
            identity = SimpleNamespace(id='admin', name='Operator', role='Admin')
            assert client.post(base + '/notifications', json={'message': 'Test', 'kind': 'voice'}).status_code == 422
            assert client.get(base).json()['audio_ready'] is True
            response = client.post(base + '/notifications', json={'message': 'Istirahat sekarang', 'kind': 'ringtone'})
            assert response.status_code == 201
            alarm = response.json()
            assert alarm['kind'] == 'ringtone'
            assert alarm['state'] == 'pending'
            assert 29 <= alarm['expires_at'] - time() <= 30
            state_path = base + f"/notifications/{alarm['id']}/state"
            assert client.post(state_path, json={'state': 'acknowledged'}).status_code == 403
            identity = SimpleNamespace(id='other', name='Other', role='Driver')
            assert client.post(base + '/audio', json={'enabled': False}).status_code == 403
            assert client.post(state_path, json={'state': 'ringing'}).status_code == 403
            identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
            assert client.get(base).json()['notifications'][0]['id'] == alarm['id']
            assert client.post(state_path, json={'state': 'ringing'}).json()['state'] == 'ringing'
            assert client.post(state_path, json={'state': 'acknowledged'}).json()['state'] == 'acknowledged'
            assert client.post(state_path, json={'state': 'ringing'}).json()['state'] == 'acknowledged'
            assert client.post(state_path, json={'state': 'invalid'}).status_code == 422
            identity = SimpleNamespace(id='admin', name='Operator', role='Admin')
            second = client.post(base + '/notifications', json={'message': 'Bangun', 'kind': 'ringtone'}).json()
            driver_routes._sessions[session_id].notifications[-1]['expires_at'] = time() - 1
            identity = SimpleNamespace(id='driver', name='Driver', role='Driver')
            assert client.post(base + f"/notifications/{second['id']}/state", json={'state': 'ringing'}).status_code == 409
            assert client.post(base + '/audio', json={'enabled': False}).status_code == 200
            assert client.get(base).json()['audio_ready'] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        driver_routes._sessions.clear()
