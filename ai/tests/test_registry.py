import json
from selamate_ai import registry


def test_planned_models_never_report_weights_or_metrics():
    status = registry.get_status()
    assert status['status'] == 'implemented'
    planned = [item for item in status['models'] if item['status'] == 'not_trained']
    assert len(planned) == 3
    assert all(item['artifact'] is None and item['metrics'] is None and not item['trained_here'] for item in planned)


def test_missing_weights_cannot_be_active(monkeypatch, tmp_path):
    from selamate_ai import fatigue
    data = {'active_model': 'eye-detector', 'models': [{'id': 'eye-detector', 'artifact': 'models/eye_detector.pt'}]}
    manifest = tmp_path / 'registry.json'
    manifest.write_text(json.dumps(data))
    monkeypatch.setattr(registry, 'REGISTRY', manifest)
    monkeypatch.setattr(fatigue, 'MODEL_PATH', tmp_path / 'missing.pt')
    result = registry.get_status()
    assert result['active_model'] is None
    assert result['models'][0]['status'] == 'missing_weights'
