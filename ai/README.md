# AI

Package selamate_ai untuk pengembangan preprocessing, training, evaluasi, dan inference.
Dependensi inti: pandas, scikit-learn, joblib. Dukungan Parquet opsional: pip install -e "./ai[parquet]". Dataset di ../data, artefak di ../models.

Backend memanggil registry melalui import Python. Modul inference dan scoring tersedia; endpoint lama tetap dipertahankan.
Dari root setelah install editable: .venv\Scripts\python.exe -m selamate_ai.

## AI modules

The existing package layout is preserved: `ai/src/selamate_ai/`.

- `fatigue.detect_eye_state(frame, confidence=0.5)` performs real YOLO inference on one image. Install with `pip install -e "./ai[vision]"`. Provision repository-root `models/eye_detector.pt` separately from Git on local and Cloudeka environments. The model loads lazily once per process; predictions are serialized for thread safety. Missing weights raise FileNotFoundError. Class names must identify OPEN and CLOSED (open/closed, open_eye/closed_eye, or eye_open/eye_closed, case insensitive). A generic eye-box detector cannot determine eye states. Missing or conflicting detections return UNKNOWN; there is no simulated prediction fallback.
- `fatigue.analyze_fatigue(observations, end_timestamp=None, max_observation_gap=1.0)` accepts strictly increasing `(timestamp_seconds, state)` pairs. Each state covers the interval until the next timestamp, capped at the observation gap limit; remaining gaps are UNKNOWN. Supply end_timestamp for the last sample to contribute duration. PERCLOS is CLOSED duration / known duration; detection_rate is known duration / total duration. UNKNOWN breaks closure segments. Closure events count starts of observed CLOSED segments, including segments at window boundaries. No known duration yields None for perclos and fatigue_score. Coverage below 50% yields INSUFFICIENT_DATA. Caller must handle this status before fusion.
- `behavior.score_behavior(speed, speed_limit, harsh_braking=0, harsh_acceleration=0, sharp_turns=0)` accepts speeds in the same units, and integer event counts or booleans in a consistent caller-defined window. Overspeed contributes up to 40 points, braking 25, acceleration 20, turns 15.
- `environment.score_environment(rainfall, visibility, road_condition, slope, disaster_risk)` uses rainfall mm/h, visibility metres, signed slope degrees, disaster risk 0–100. Road conditions: dry, wet, damaged, flooded, icy. Rain saturates at 50 mm/h; visibility risk drops to zero at 1000 m; slope saturates at 15 degrees. Weights: rain 20%, visibility 25%, road 20%, slope 10%, disaster 25%.
- `fusion.fuse_risk(fatigue_score, behavior_score, environment_score)` requires finite 0–100 scores; missing scores are rejected. Weights are fatigue 50%, behavior 30%, environment 20%. Dominant factor is the largest weighted contribution, with ties resolved in that order; all-zero scores yield none. Output includes a warning and component_breakdown.

Risk levels: LOW below 40, MEDIUM below 70, HIGH from 70. Fatigue score uses 60% PERCLOS (saturation at 40%) and 40% maximum closure duration (saturation at 3 seconds); statuses are ALERT, DROWSY, FATIGUED, or INSUFFICIENT_DATA. These are initial hackathon heuristics requiring calibration with real data, not a validated safety model.

Backend can import these functions directly from selamate_ai modules. Keep timestamp windows isolated per driver/session in the caller. No additional API application is created, and existing frontend/API behavior is preserved. Registry remains a legacy status placeholder until endpoint integration.

Validation: `.venv\Scripts\python.exe -m unittest discover -s ai/tests -p test_risk_modules.py`.

Video entry point: `fatigue.analyze_video(path, max_duration_seconds=300)` decodes each frame with OpenCV, calls real eye inference, and releases the decoder on every exit path. It uses nominal FPS for timestamps and passes observations to analyze_fatigue. Invalid videos/durations raise ValueError; model configuration/loading problems raise EyeModelError. Backend now exposes the functions through its existing FastAPI application.
