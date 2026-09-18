import json
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[3] / "models/registry.json"


def get_status():
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    root = REGISTRY.parent.parent
    models = []
    for entry in registry["models"]:
        item = dict(entry)
        if item.get("artifact"):
            from .fatigue import MODEL_PATH as eye_path
            from .yawning import MODEL_PATH as face_path
            path = eye_path if item["id"] == "eye-detector" else face_path if item["id"] == "face-landmarker" else root / item["artifact"]
            item["artifact_available"] = path.is_file()
            if not item["artifact_available"]:
                item["status"] = "missing_weights"
        models.append(item)
    return {
        "service": "selamate-ai",
        "status": "implemented",
        "active_model": next((item['id'] for item in models if item['id'] == registry['active_model'] and item.get('artifact_available')), None),
        "message": "Deteksi mata dan landmark wajah menggunakan model tersedia/pretrained. Modul lain yang belum dilatih ditandai secara eksplisit; skor demo menggunakan algoritma.",
        "models": models,
    }
