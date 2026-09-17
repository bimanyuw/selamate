from time import time
import hashlib
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from selamate_backend import auth, driver_routes
from selamate_backend.main import app
from selamate_backend.database import Base, get_session
from selamate_backend.models import AuthSession, User
from selamate_backend.config import settings

PASSWORD = 'Example-password-123'


def test_persistent_admin_authorization(client):
    browser, engine = client
    assert browser.get('/api/admin/summary').status_code == 401
    assert register(browser).status_code == 201
    assert browser.get('/api/admin/summary').status_code == 403
    with Session(engine) as db:
        user = db.scalar(select(User))
        user.role = 'Admin'
        db.commit()
    response = browser.get('/api/admin/summary')
    assert response.status_code == 200
    assert response.json()['activeUsers'] == 1
    assert browser.get('/api/auth/me').json()['role'] == 'Admin'
    assert browser.post('/api/auth/register', json={'name': 'Escalation', 'email': 'other@example.com', 'password': PASSWORD, 'role': 'Admin'}).status_code == 422


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    auth._attempts.clear(); driver_routes._sessions.clear()
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    def sessions():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_session] = sessions
    with TestClient(app) as value:
        yield value, engine
    app.dependency_overrides.clear()
    driver_routes._sessions.clear(); auth._attempts.clear()
    engine.dispose()


def register(client, email='driver@example.com'):
    return client.post('/api/auth/register', json={'name': ' Driver ', 'email': email, 'password': PASSWORD})


def test_register_login_logout_and_protected_routes(client):
    browser, engine = client
    assert browser.get('/api/auth/me').status_code == 401
    assert browser.post('/api/behavior', json={'speed': 60, 'speed_limit': 60}).status_code == 401
    assert browser.post('/api/driver/sessions').status_code == 401
    response = register(browser, 'DRIVER@example.com')
    assert response.status_code == 201
    assert response.json()['name'] == 'Driver'
    assert response.json()['email'] == 'driver@example.com'
    assert set(response.json()) == {'id', 'name', 'email', 'role'}
    assert response.json()['role'] == 'Driver'
    assert 'HttpOnly' in response.headers['set-cookie']
    assert 'SameSite=lax' in response.headers['set-cookie']
    token = browser.cookies.get(auth.COOKIE)
    with Session(engine) as db:
        user = db.scalar(select(User))
        assert user.password_hash.startswith('$argon2id$')
        assert user.password_hash != PASSWORD
        assert auth.hasher.verify(user.password_hash, PASSWORD)
        row = db.scalar(select(AuthSession))
        assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert row.expires_at > time()
    assert browser.get('/api/auth/me').status_code == 200
    assert browser.post('/api/behavior', json={'speed': 60, 'speed_limit': 60}).status_code == 200
    assert browser.post('/api/auth/logout').status_code == 200
    assert browser.cookies.get(auth.COOKIE) is None
    assert browser.get('/api/auth/me').status_code == 401
    browser.cookies.set(auth.COOKIE, token)
    assert browser.get('/api/auth/me').status_code == 401
    browser.cookies.clear()
    assert browser.post('/api/auth/login', json={'email': 'driver@example.com', 'password': PASSWORD}).status_code == 200


def test_duplicate_and_invalid_credentials(client):
    browser, engine = client
    assert register(browser).status_code == 201
    assert register(browser, 'DRIVER@example.com').status_code == 409
    first = browser.post('/api/auth/login', json={'email': 'driver@example.com', 'password': 'incorrect-password'})
    second = browser.post('/api/auth/login', json={'email': 'missing@example.com', 'password': 'incorrect-password'})
    assert first.status_code == second.status_code == 401
    assert first.json() == second.json()
    assert browser.post('/api/auth/register', json={'name': 'Test', 'email': 'invalid', 'password': 'short'}).status_code == 422


def test_expiration_and_rotation(client):
    browser, engine = client
    register(browser)
    first_token = browser.cookies.get(auth.COOKIE)
    browser.post('/api/auth/login', json={'email': 'driver@example.com', 'password': PASSWORD})
    second_token = browser.cookies.get(auth.COOKIE)
    assert second_token != first_token
    with Session(engine) as db:
        assert db.get(AuthSession, auth._digest(first_token)) is None
        row = db.get(AuthSession, auth._digest(second_token))
        row.expires_at = int(time()) - 1; db.commit()
    assert browser.get('/api/auth/me').status_code == 401


def test_origin_and_secure_cookie(client, monkeypatch):
    browser, engine = client
    assert browser.post('/api/auth/register', json={'name': 'Test', 'email': 'test@example.com', 'password': PASSWORD}, headers={'Origin': 'https://evil.example'}).status_code == 403
    monkeypatch.setattr(settings, 'auth_cookie_secure', True)
    response = register(browser)
    assert response.status_code == 201
    assert 'Secure' in response.headers['set-cookie']
    monkeypatch.setattr(settings, 'auth_cookie_secure', False)
    monkeypatch.setattr(settings, 'auth_cookie_samesite', 'none')
    assert browser.post('/api/auth/login', json={'email': 'driver@example.com', 'password': PASSWORD}).status_code == 503


def test_driver_writes_require_owner(client):
    browser, engine = client
    register(browser, 'one@example.com')
    session_id = browser.post('/api/driver/sessions').json()['session_id']
    browser.post('/api/auth/logout')
    register(browser, 'two@example.com')
    assert browser.post(f'/api/driver/sessions/{session_id}/telemetry', json={}).status_code == 403
    assert browser.post(f'/api/driver/sessions/{session_id}/stop').status_code == 403
    assert browser.get(f'/api/driver/sessions/{session_id}').status_code == 200


def test_database_unavailable_is_clear(client):
    browser, engine = client
    class OfflineSession:
        def scalar(self, *args):
            raise OperationalError('SELECT', {}, Exception('offline'))
        def rollback(self):
            pass
    app.dependency_overrides[get_session] = lambda: OfflineSession()
    response = browser.post('/api/auth/login', json={'email': 'test@example.com', 'password': PASSWORD})
    assert response.status_code == 503
    assert 'db:migrate' in response.json()['detail']


def test_rate_limit(client):
    browser, engine = client
    from time import monotonic
    from collections import deque
    auth._attempts['testclient'] = deque([monotonic()] * 30)
    assert register(browser).status_code == 429
