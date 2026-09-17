from selamate_ai.registry import get_status


def test_no_model_means_no_prediction():
    status = get_status()
    assert status["active_model"] is None
    assert status["status"] == "not_implemented"
