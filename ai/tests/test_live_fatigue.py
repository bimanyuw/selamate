from selamate_ai.fatigue import analyze_live_fatigue
from selamate_ai.yawning import analyze_live_yawning, resolve_eye_state


def test_startup_open_eyes_is_unknown_then_alert_without_fake_score():
    for end in range(5):
        result = analyze_live_fatigue([(i, 'OPEN') for i in range(end + 1)])
        assert result['fatigue_status'] == 'INSUFFICIENT_DATA'
        assert result['fatigue_score'] is None
    result = analyze_live_fatigue([(i, 'OPEN') for i in range(6)])
    assert result['fatigue_status'] == 'ALERT' and result['fatigue_score'] == 0


def test_short_blinks_and_single_false_closed_sample_do_not_trigger_drowsiness():
    samples = [(i / 4, 'CLOSED' if i % 8 == 4 else 'OPEN') for i in range(41)]
    result = analyze_live_fatigue(samples)
    assert result['fatigue_status'] == 'ALERT' and result['fatigue_score'] == 0


def test_real_closure_warns_and_open_recovery_clears_history_without_rebound():
    samples = [(i / 2, 'OPEN') for i in range(11)]
    samples += [(i / 2, 'CLOSED') for i in range(11, 18)]
    result = analyze_live_fatigue(samples)
    assert result['fatigue_status'] == 'FATIGUED' and result['fatigue_score'] >= 70
    samples += [(i / 2, 'OPEN') for i in range(18, 23)]
    recovered = analyze_live_fatigue(samples)
    assert recovered['fatigue_score'] == 0 and recovered['fatigue_status'] == 'ALERT'
    samples += [(11.5, 'CLOSED'), (12, 'OPEN'), (12.5, 'OPEN')]
    assert analyze_live_fatigue(samples)['fatigue_score'] == 0


def test_face_loss_and_dropped_frames_never_mean_recovery_or_continuous_closure():
    samples = [(i, 'OPEN') for i in range(6)] + [(6, 'UNKNOWN')]
    assert analyze_live_fatigue(samples)['fatigue_score'] is None
    gaps = [(0, 'CLOSED'), (10, 'CLOSED'), (20, 'CLOSED')]
    assert analyze_live_fatigue(gaps)['fatigue_status'] == 'INSUFFICIENT_DATA'


def test_yawn_risk_clears_after_mouth_closes_but_count_is_preserved():
    samples = [(i / 2, 'OPEN') for i in range(9)]
    assert analyze_live_yawning(samples)['yawn_score'] >= 70
    samples += [(i / 2, 'CLOSED') for i in range(9, 14)]
    recovered = analyze_live_yawning(samples)
    assert recovered['yawn_count'] == 1 and recovered['yawn_score'] == 0


def test_clear_face_evidence_corrects_yolo_and_missing_landmarks_keep_valid_eye_detection():
    assert resolve_eye_state('CLOSED', {'status': 'READY', 'landmark_eye_state': 'OPEN'}) == 'OPEN'
    assert resolve_eye_state('OPEN', {'status': 'READY', 'landmark_eye_state': 'CLOSED'}) == 'CLOSED'
    assert resolve_eye_state('CLOSED', {'status': 'READY', 'landmark_eye_state': 'UNKNOWN'}) == 'CLOSED'
    assert resolve_eye_state('CLOSED', {'status': 'NO_FACE'}) == 'CLOSED'
    assert resolve_eye_state('UNKNOWN', {'status': 'NO_FACE'}) == 'UNKNOWN'
    assert resolve_eye_state('CLOSED', {'status': 'UNAVAILABLE'}) == 'CLOSED'
