"""Periksa registry model tanpa menjalankan prediksi palsu."""
import json
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[3]
    registry = json.loads((root / "models" / "registry.json").read_text(encoding="utf-8"))
    print(json.dumps({
        "service": "selamate-ai",
        "status": "scaffold",
        "active_model": registry["active_model"],
        "message": "Pipeline training dan inference belum diimplementasikan.",
    }, indent=2))


if __name__ == "__main__":
    main()
