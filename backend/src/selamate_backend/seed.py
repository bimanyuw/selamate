"""Seed contoh secara idempotent tanpa menimpa record yang sudah ada."""
import json
from .config import ROOT
from .database import SessionLocal
from .models import Alert
from .schemas import AlertResponse


def main():
    rows = json.loads((ROOT / "data/samples/alerts.json").read_text(encoding="utf-8"))
    with SessionLocal.begin() as session:
        for row in rows:
            value = AlertResponse.model_validate(row)
            if session.get(Alert, value.id) is None:
                session.add(Alert(**value.model_dump()))
    print("Data simulasi siap.")


if __name__ == "__main__":
    main()
