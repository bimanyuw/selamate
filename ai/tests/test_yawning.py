from selamate_ai.yawning import analyze_yawning, combine_fatigue


def test_speech_short_openings_do_not_count_and_long_openings_count_once():
    short = analyze_yawning([(0, 'OPEN'), (.4, 'CLOSED'), (1, 'OPEN'), (1.4, 'CLOSED'), (2, 'CLOSED')])
    assert short['yawn_count'] == 0 and short['yawn_score'] == 0
    long = analyze_yawning([(i / 2, 'OPEN') for i in range(9)])
    assert long['yawn_count'] == 1 and long['yawn_score'] == 70


def test_gaps_and_missing_faces_never_count_as_continuous_yawning():
    gap = analyze_yawning([(0, 'OPEN'), (10, 'OPEN'), (11, 'CLOSED')])
    assert gap['yawn_score'] is None
    unknown = analyze_yawning([(0, 'UNKNOWN'), (1, 'UNKNOWN'), (2, 'UNKNOWN')])
    assert unknown['yawn_score'] is None


def test_repeated_yawns_increase_score_and_eyes_are_not_diluted():
    samples = [(i / 2, 'OPEN' if i % 5 < 4 else 'CLOSED') for i in range(16)]
    mouth = analyze_yawning(samples)
    assert mouth['yawn_count'] == 3 and mouth['yawn_score'] == 80
    eyes = {'fatigue_score': 95, 'fatigue_status': 'FATIGUED', 'detection_rate': 1}
    assert combine_fatigue(eyes, mouth)['fatigue_score'] == 95
    eyes = {'fatigue_score': None, 'fatigue_status': 'INSUFFICIENT_DATA', 'detection_rate': 0}
    assert combine_fatigue(eyes, mouth)['fatigue_status'] == 'FATIGUED'
    quiet = analyze_yawning([(0, 'CLOSED'), (1, 'CLOSED')])
    assert combine_fatigue(eyes, quiet)['fatigue_status'] == 'INSUFFICIENT_DATA'


def test_missing_face_model_fails_open_for_eye_pipeline(monkeypatch, tmp_path):
    from selamate_ai import yawning
    monkeypatch.setattr(yawning, 'MODEL_PATH', tmp_path / 'missing.task')
    result = yawning.detect_image_bytes(b'no image')
    assert result['status'] == 'UNAVAILABLE'
    assert result['mouth_state'] == 'UNKNOWN'
