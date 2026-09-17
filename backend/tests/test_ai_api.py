from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from selamate_ai import fatigue
from selamate_backend import ai_routes
from selamate_backend.config import settings
from selamate_backend.main import app


@pytest.fixture
def client():
    with TestClient(app) as value:
        yield value


@pytest.fixture
def upload_directories(monkeypatch):
    directories = []
    original = ai_routes.TemporaryDirectory

    def tracked_directory(*args, **kwargs):
        temporary = original(*args, **kwargs)
        directories.append(Path(temporary.name))
        return temporary

    monkeypatch.setattr(ai_routes, "TemporaryDirectory", tracked_directory)
    yield directories
    assert all(not directory.exists() for directory in directories)


def test_health_alias_and_existing_routes(client):
    assert client.get('/health').json() == client.get('/api/health').json()
    assert client.get('/api/ai/status').status_code == 200


@pytest.mark.parametrize('prefix', ['/api', ''])
def test_scoring_routes_and_aliases(client, prefix):
    behavior = client.post(prefix + '/behavior', json={
        'speed': 90, 'speed_limit': 60, 'harsh_braking': 1,
        'harsh_acceleration': True, 'sharp_turns': 0,
    })
    assert behavior.status_code == 200
    assert behavior.json()['behavior_score'] == 58
    environment = client.post(prefix + '/environment', json={
        'rainfall': 0, 'visibility': 1000, 'road_condition': 'dry',
        'slope': 0, 'disaster_risk': 0,
    })
    assert environment.status_code == 200
    assert environment.json()['environment_score'] == 0
    result = client.post(prefix + '/risk', json={
        'fatigue_score': 80, 'behavior_score': behavior.json()['behavior_score'],
        'environment_score': environment.json()['environment_score'],
    })
    assert result.status_code == 200
    assert result.json()['overall_risk_score'] == 57.4
    assert result.json()['dominant_factor'] == 'fatigue'
    assert set(result.json()['component_breakdown']) == {'fatigue', 'behavior', 'environment'}


@pytest.mark.parametrize('path,payload', [
    ('behavior', {'speed': 10, 'speed_limit': 0}),
    ('behavior', {'speed': -1, 'speed_limit': 60}),
    ('behavior', {'speed': 10, 'speed_limit': 60, 'harsh_braking': 1.5}),
    ('behavior', {'speed': 10, 'speed_limit': 60, 'sharp_turns': -1}),
    ('environment', {'rainfall': 0, 'visibility': 1, 'road_condition': 'unknown', 'slope': 0, 'disaster_risk': 0}),
    ('risk', {'fatigue_score': None, 'behavior_score': 0, 'environment_score': 0}),
    ('risk', {'fatigue_score': 101, 'behavior_score': 0, 'environment_score': 0}),
    ('risk', {'fatigue_score': 0, 'behavior_score': 0, 'environment_score': 0, 'extra': 1}),
])
def test_validation_errors(client, path, payload):
    assert client.post('/api/' + path, json=payload).status_code == 422


def test_fatigue_requires_video_file(client):
    assert client.post('/api/fatigue').status_code == 422
    assert client.post('/api/fatigue', files={'file': ('eyes.txt', b'x', 'text/plain')}).status_code == 422


def test_empty_upload_cleanup(client, upload_directories):
    response = client.post('/api/fatigue', files={'file': ('empty.mp4', b'', 'video/mp4')})
    assert response.status_code == 422
    assert 'empty' in response.json()['detail']
    assert upload_directories


def test_oversized_upload_cleanup(client, monkeypatch, upload_directories):
    monkeypatch.setattr(settings, 'fatigue_max_upload_bytes', 2)
    assert client.post('/api/fatigue', files={'file': ('large.mp4', b'123', 'video/mp4')}).status_code == 413
    assert upload_directories


def test_invalid_video_cleanup(client, upload_directories):
    pytest.importorskip('cv2')
    response = client.post('/fatigue', files={'file': ('invalid.mp4', b'not a video', 'video/mp4')})
    assert response.status_code == 422
    assert 'decode' in response.json()['detail']
    assert upload_directories


@pytest.fixture
def small_video(tmp_path):
    cv2 = pytest.importorskip('cv2')
    np = pytest.importorskip('numpy')
    path = tmp_path / 'test.avi'
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'MJPG'), 10, (32, 32))
    if not writer.isOpened():
        pytest.skip('MJPG encoding unavailable in installed OpenCV')
    try:
        for _ in range(2):
            writer.write(np.zeros((32, 32, 3), dtype=np.uint8))
    finally:
        writer.release()
    return path.read_bytes()


def test_missing_model_is_503_and_cleans_upload(client, small_video, tmp_path, monkeypatch, upload_directories):
    monkeypatch.setattr(fatigue, 'MODEL_PATH', tmp_path / 'missing' / 'eye_detector.pt')
    monkeypatch.setattr(fatigue, '_model', None)
    response = client.post('/api/fatigue', files={'file': ('test.avi', small_video, 'video/x-msvideo')})
    assert response.status_code == 503
    assert 'Eye detector model missing' in response.json()['detail']
    assert upload_directories


def test_duration_limit_before_inference(client, small_video, monkeypatch, upload_directories):
    monkeypatch.setattr(settings, 'fatigue_max_video_seconds', .1)
    response = client.post('/api/fatigue', files={'file': ('test.avi', small_video, 'video/x-msvideo')})
    assert response.status_code == 422
    assert 'processing limit' in response.json()['detail']


def test_configurable_cors(client, monkeypatch):
    cors = next(middleware for middleware in app.user_middleware if middleware.cls.__name__ == 'CORSMiddleware')
    monkeypatch.setitem(cors.kwargs, 'allow_origins', ['https://frontend.example'])
    app.middleware_stack = None
    try:
        response = client.options('/api/behavior', headers={
            'Origin': 'https://frontend.example', 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        })
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'https://frontend.example'
        assert client.options('/api/behavior', headers={
            'Origin': 'https://other.example', 'Access-Control-Request-Method': 'POST',
        }).status_code == 400
    finally:
        app.middleware_stack = None
