from types import SimpleNamespace
import pytest
from selamate_backend.auth import get_current_user
from selamate_backend.main import app


@pytest.fixture(autouse=True)
def authenticated_existing_feature_tests(request):
    """Existing feature tests exercise scoring/database behavior after login."""
    if request.module.__name__.endswith('test_auth'):
        yield
        return
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id='feature-test-user', name='Test', email='test@example.com')
    yield
    app.dependency_overrides.pop(get_current_user, None)
