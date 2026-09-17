import json

import pytest
from fastapi.testclient import TestClient
from selamate_backend.main import app


@pytest.mark.parametrize('value', [float('nan'), float('inf'), float('-inf')])
def test_nonfinite_scores_return_serializable_validation_error(value):
    with TestClient(app) as client:
        response = client.post('/api/risk', content=json.dumps({
            'fatigue_score': value, 'behavior_score': 0, 'environment_score': 0,
        }), headers={'content-type': 'application/json'})
    assert response.status_code == 422
    assert response.json()['detail'][0]['type'] == 'finite_number'
