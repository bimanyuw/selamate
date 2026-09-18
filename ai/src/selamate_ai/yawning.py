"""Pretrained face landmarks + temporal mouth-opening heuristic, not a trained yawn classifier."""
import atexit
import logging
import os
from pathlib import Path
from threading import Lock

MODEL_PATH = Path(os.environ.get("FACE_MODEL_PATH", str(Path(__file__).resolve().parents[3] / "models/face_landmarker.task")))
_model = None
_lock = Lock()
_unavailable_logged = False


def close():
    global _model
    with _lock:
        if _model is not None:
            try:
                _model.close()
            except RuntimeError:
                # Interpreter shutdown may have stopped MediaPipe's executor.
                pass
            _model = None


atexit.register(close)


def detect_image_bytes(data):
    """Optional mouth inference. Unavailable/no face is UNKNOWN, never CLOSED."""
    global _model, _unavailable_logged
    try:
        import cv2
        import numpy as np
        import mediapipe as mp
        if not MODEL_PATH.is_file():
            raise FileNotFoundError("Model wajah belum tersedia; jalankan scripts/setup-face-model.py")
        frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Frame tidak dapat dibaca")
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        with _lock:
            if _model is None:
                options = mp.tasks.vision.FaceLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH)),
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_faces=1, output_face_blendshapes=True,
                )
                _model = mp.tasks.vision.FaceLandmarker.create_from_options(options)
            result = _model.detect(image)
        if not result.face_blendshapes:
            return {"mouth_state": "UNKNOWN", "jaw_open": None, "status": "NO_FACE"}
        values = {item.category_name: item.score for item in result.face_blendshapes[0]}
        jaw = values.get("jawOpen")
        left, right = values.get('eyeBlinkLeft'), values.get('eyeBlinkRight')
        eyes = 'UNKNOWN' if left is None or right is None else 'CLOSED' if min(left, right) >= .65 else 'OPEN' if max(left, right) <= .4 else 'UNKNOWN'
        return {"mouth_state": "UNKNOWN" if jaw is None else "OPEN" if jaw >= .5 else "CLOSED", "jaw_open": round(jaw, 3) if jaw is not None else None, "status": "READY",
                "landmark_eye_state": eyes, "eye_blink_left": left, "eye_blink_right": right}
    except Exception:
        if not _unavailable_logged:
            logging.getLogger(__name__).exception("Mouth detection unavailable; eye detection continues")
            _unavailable_logged = True
        return {"mouth_state": "UNKNOWN", "jaw_open": None, "status": "UNAVAILABLE"}


def analyze_yawning(observations, max_observation_gap=1.5):
    """One event per continuous opening >=1.5 s; gaps break continuity.

    Short openings (e.g. speech) don't count. Sustained speech can still resemble
    yawning: these are indications, not a validated classification of yawns.
    """
    samples = list(observations)
    current = maximum = known = 0.0
    events = 0
    counted = False
    for (timestamp, state), (next_timestamp, _) in zip(samples, samples[1:]):
        interval = next_timestamp - timestamp
        if interval <= 0 or state not in {"OPEN", "CLOSED", "UNKNOWN"}:
            raise ValueError("Invalid mouth observations")
        duration = min(interval, max_observation_gap)
        if state != "UNKNOWN":
            known += duration
        if state == "OPEN":
            current += duration
            maximum = max(maximum, current)
            if current >= 1.5 and not counted:
                events += 1
                counted = True
        else:
            current = 0.0
            counted = False
        if interval > max_observation_gap:
            current = 0.0
            counted = False
    total = samples[-1][0] - samples[0][0] if samples else 0
    coverage = known / total if total else 0
    score = max(80 if events >= 3 else 60 if events >= 2 else 40 if events else 0,
                70 if maximum >= 3 else 0) if coverage >= .5 else None
    return {"yawn_count": events, "max_mouth_open_duration": round(maximum, 2),
            "yawn_score": score, "mouth_detection_rate": coverage}


def combine_fatigue(eyes, mouth):
    """Strongest available eye/yawn signal wins; missing signals remain explicit."""
    eye_score = eyes["fatigue_score"] if eyes["fatigue_status"] != "INSUFFICIENT_DATA" else None
    result = {**eyes, **mouth, "eye_fatigue_score": eye_score}
    yawn_score = mouth["yawn_score"]
    # A closed mouth alone cannot establish that the driver is alert.
    available = [score for score in (eye_score, yawn_score if yawn_score and yawn_score >= 40 else None) if score is not None]
    score = max(available) if available else None
    result["fatigue_score"] = score
    result["fatigue_status"] = "INSUFFICIENT_DATA" if score is None else "FATIGUED" if score >= 70 else "DROWSY" if score >= 40 else "ALERT"
    result["detection_rate"] = max(eyes["detection_rate"], mouth["mouth_detection_rate"])
    return result


def analyze_live_yawning(observations, max_observation_gap=1.5):
    """Keep a 60-second count, but clear live yawn risk after mouth recovery."""
    samples = list(observations)
    summary = analyze_yawning(samples, max_observation_gap)
    if not samples:
        return summary
    closed_start = None
    checkpoint = samples[0][0]
    previous = None
    for timestamp, state in samples:
        contiguous = previous is not None and timestamp - previous <= max_observation_gap
        if state == 'CLOSED':
            if closed_start is None or not contiguous:
                closed_start = timestamp
            if timestamp - closed_start >= 2:
                checkpoint = closed_start
        else:
            closed_start = None
        previous = timestamp
    recent = [(timestamp, state) for timestamp, state in samples if timestamp >= max(checkpoint, samples[-1][0] - 10)]
    live = analyze_yawning(recent, max_observation_gap)
    summary['yawn_score'] = live['yawn_score'] if samples[-1][1] != 'UNKNOWN' else None
    summary['mouth_detection_rate'] = live['mouth_detection_rate']
    return summary


def resolve_eye_state(yolo_state, face):
    """Eye inference is independent of mouth/face availability.

    Prefer clear landmark evidence to correct false YOLO closures. If landmarks
    are ambiguous/missing, retain a valid YOLO result. Both missing stays UNKNOWN.
    """
    landmark = face.get('landmark_eye_state') if face.get('status') == 'READY' else None
    if landmark in {'OPEN', 'CLOSED'}:
        return landmark
    return yolo_state if yolo_state in {'OPEN', 'CLOSED'} else 'UNKNOWN'
