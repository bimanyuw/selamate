import unittest
from selamate_ai.behavior import score_behavior
from selamate_ai.environment import score_environment
from selamate_ai.fusion import fuse_risk
from selamate_ai.fatigue import MODEL_PATH, analyze_fatigue, _get_model


class RiskModulesTests(unittest.TestCase):
    def test_temporal_durations_and_unknown(self):
        result = analyze_fatigue([(0, 'OPEN'), (1, 'CLOSED'), (2, 'CLOSED'), (3, 'UNKNOWN'), (4, 'CLOSED')], end_timestamp=5)
        self.assertEqual(result['max_closed_duration'], 2)
        self.assertEqual(result['closure_events'], 2)
        self.assertEqual(result['perclos'], .75)
        self.assertEqual(result['detection_rate'], .8)

    def test_gap_does_not_inflate_closure(self):
        result = analyze_fatigue([(0, 'CLOSED'), (10, 'CLOSED')], end_timestamp=11)
        self.assertEqual(result['max_closed_duration'], 1)
        self.assertEqual(result['closure_events'], 2)
        self.assertEqual(result['fatigue_status'], 'INSUFFICIENT_DATA')

    def test_no_observation_is_not_safe(self):
        for observations in ([], [(0, 'UNKNOWN'), (1, 'UNKNOWN')]):
            result = analyze_fatigue(observations)
            self.assertIsNone(result['fatigue_score'])
            self.assertIsNone(result['perclos'])
            self.assertEqual(result['fatigue_status'], 'INSUFFICIENT_DATA')

    def test_invalid_timestamps(self):
        with self.assertRaises(ValueError):
            analyze_fatigue([(1, 'OPEN'), (1, 'CLOSED')])

    def test_behavior_extremes(self):
        self.assertEqual(score_behavior(40, 60)['behavior_score'], 0)
        self.assertEqual(score_behavior(120, 60, 10, 10, 10)['behavior_score'], 100)
        with self.assertRaises(ValueError):
            score_behavior(40, 0)
        with self.assertRaises(ValueError):
            score_behavior(40, 60, harsh_braking=-1)

    def test_environment_extremes(self):
        self.assertEqual(score_environment(0, 1000, 'dry', 0, 0)['environment_score'], 0)
        self.assertEqual(score_environment(50, 0, 'flooded', 15, 100)['environment_score'], 100)
        with self.assertRaises(ValueError):
            score_environment(0, 1000, 'unknown', 0, 0)

    def test_fusion_and_validation(self):
        result = fuse_risk(80, 20, 30)
        self.assertEqual(result['overall_risk_score'], 52)
        self.assertEqual(result['dominant_factor'], 'fatigue')
        self.assertEqual(result['risk_level'], 'MEDIUM')
        for invalid in (None, float('nan'), -1, 101):
            with self.assertRaises(ValueError):
                fuse_risk(invalid, 0, 0)

    def test_missing_model_error(self):
        self.assertEqual(MODEL_PATH.name, 'eye_detector.pt')
        if MODEL_PATH.is_file():
            self.skipTest('Production weights present; no inference performed by this test')
        with self.assertRaisesRegex(FileNotFoundError, 'Eye detector model missing'):
            _get_model()
