import json
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[3] / "models/registry.json"


def get_status():
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {
        "service": "selamate-ai",
        "status": "not_implemented",
        "active_model": registry["active_model"],
        "message": "Training dan inference belum diimplementasikan.",
    }
