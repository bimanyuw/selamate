"""Real YOLO eye inference and timestamp-based fatigue analysis."""
from pathlib import Path
from threading import Lock
from .behavior import _number

MODEL_PATH = Path(__file__).resolve().parents[3] / "models" / "eye_detector.pt"
EYE_STATES = frozenset({"OPEN", "CLOSED", "UNKNOWN"})
_model = None
_model_lock = Lock()
_prediction_lock = Lock()


class EyeModelError(RuntimeError):
    """Weights or class definitions cannot support eye-state inference."""


def _get_model():
    global _model
    with _model_lock:
        if _model is None:
            if not MODEL_PATH.is_file():
                raise FileNotFoundError(f"Eye detector model missing: {MODEL_PATH}. Provision models/eye_detector.pt separately from Git.")
            try:
                from ultralytics import YOLO
            except ImportError as exc:
                raise ImportError('Eye inference requires: pip install -e "./ai[vision]"') from exc
            try:
                _model = YOLO(str(MODEL_PATH))
            except Exception as exc:
                raise EyeModelError("Cannot load models/eye_detector.pt. Check weights and installed inference dependencies.") from exc
        return _model


def detect_eye_state(frame, confidence=0.5):
    """One frame; absent or conflicting eye detections return UNKNOWN."""
    confidence = _number("confidence", confidence, 0, 1)
    model = _get_model()
    aliases = {"open": "OPEN", "open_eye": "OPEN", "eye_open": "OPEN", "closed": "CLOSED", "closed_eye": "CLOSED", "eye_closed": "CLOSED", "unknown": "UNKNOWN"}
    names = model.names.values() if isinstance(model.names, dict) else model.names
    if not {"OPEN", "CLOSED"}.issubset({aliases.get(str(name).strip().lower()) for name in names}):
        raise EyeModelError("Eye detector must contain named OPEN and CLOSED classes; generic eye boxes cannot determine eye state.")
    with _prediction_lock:
        results = model.predict(source=frame, conf=confidence, verbose=False)
    if len(results) != 1:
        raise ValueError("detect_eye_state expects exactly one image/frame")
    boxes = results[0].boxes
    if boxes is None or len(boxes) == 0:
        return "UNKNOWN"
    states = {aliases.get(str(model.names[int(class_id)]).strip().lower(), "UNKNOWN") for class_id in boxes.cls.tolist()}
    return states.pop() if len(states) == 1 else "UNKNOWN"


def analyze_fatigue(observations, end_timestamp=None, max_observation_gap=1.0):
    """Ordered (seconds, state) samples; long gaps are UNKNOWN, not closure."""
    gap = _number("max_observation_gap", max_observation_gap)
    if gap == 0:
        raise ValueError("max_observation_gap must be greater than zero")
    samples = []
    for timestamp, state in observations:
        timestamp = _number("timestamp", timestamp)
        if state not in EYE_STATES:
            raise ValueError("Eye state must be OPEN, CLOSED, or UNKNOWN")
        if samples and timestamp <= samples[-1][0]:
            raise ValueError("Observation timestamps must strictly increase")
        samples.append((timestamp, state))
    end = samples[-1][0] if samples else 0.0
    if end_timestamp is not None:
        end = _number("end_timestamp", end_timestamp)
        if samples and end < samples[-1][0]:
            raise ValueError("end_timestamp precedes the final observation")
    known = closed = current = maximum = 0.0
    events = 0
    previous = "UNKNOWN"
    for index, (timestamp, state) in enumerate(samples):
        next_timestamp = samples[index + 1][0] if index + 1 < len(samples) else end
        interval = next_timestamp - timestamp
        duration = min(interval, gap)
        if duration <= 0:
            continue
        if state != "UNKNOWN":
            known += duration
        if state == "CLOSED":
            if previous != "CLOSED":
                events += 1
            closed += duration
            current += duration
            maximum = max(maximum, current)
        else:
            current = 0.0
        previous = state
        if interval > gap:
            current = 0.0
            previous = "UNKNOWN"
    total = end - samples[0][0] if samples else 0.0
    perclos = closed / known if known else None
    detection_rate = known / total if total else 0.0
    score = round(100 * (.6 * min(1, perclos / .4) + .4 * min(1, maximum / 3)), 2) if known else None
    status = "INSUFFICIENT_DATA" if detection_rate < .5 or score is None else "FATIGUED" if score >= 70 else "DROWSY" if score >= 40 else "ALERT"
    return {"max_closed_duration": maximum, "perclos": perclos, "closure_events": events, "detection_rate": detection_rate, "fatigue_score": score, "fatigue_status": status}



def detect_image_bytes(data):
    """Decode an uploaded image in memory; no fake inference or disk writes."""
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise ImportError('Frame inference requires: pip install -e "./ai[vision]"') from exc
    if not data:
        raise ValueError("Frame kosong")
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Frame tidak dapat dibaca")
    if frame.shape[0] > 2048 or frame.shape[1] > 2048:
        raise ValueError("Dimensi frame maksimal 2048 piksel")
    return detect_eye_state(frame)


def analyze_video(video_path, max_duration_seconds=300):
    """Decode every frame and infer eye states; timestamps use video FPS.

    Decoder resources are released on all paths. Only the model is cached;
    observation windows are isolated per call.
    """
    import math

    limit = _number("max_duration_seconds", max_duration_seconds)
    if limit == 0:
        raise ValueError("max_duration_seconds must be greater than zero")
    try:
        import cv2
    except ImportError as exc:
        raise ImportError('Video inference requires: pip install -e "./ai[vision]"') from exc
    capture = cv2.VideoCapture(str(video_path))
    try:
        if not capture.isOpened():
            raise ValueError("Video cannot be decoded. Upload a supported, readable video.")
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not math.isfinite(fps) or fps <= 0:
            raise ValueError("Video has no valid frame rate")
        frame_count = capture.get(cv2.CAP_PROP_FRAME_COUNT)
        if math.isfinite(frame_count) and frame_count > 0 and frame_count / fps > limit:
            raise ValueError(f"Video exceeds the {limit:g}-second processing limit")
        observations = []
        while True:
            success, frame = capture.read()
            if not success:
                break
            if (len(observations) + 1) / fps > limit:
                raise ValueError(f"Video exceeds the {limit:g}-second processing limit")
            observations.append((len(observations) / fps, detect_eye_state(frame)))
        if not observations:
            raise ValueError("Video contains no decodable frames")
        return analyze_fatigue(observations, end_timestamp=len(observations) / fps)
    finally:
        capture.release()
