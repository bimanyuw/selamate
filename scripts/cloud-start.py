"""Initialize the hosted single-worker API without exposing connection secrets."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
from urllib.parse import urlparse


def main():
    connection = os.environ.get("DATABASE_URL", "")
    if not connection:
        raise RuntimeError("DATABASE_URL wajib diisi dengan PostgreSQL online")
    for prefix in ("postgres://", "postgresql://"):
        if connection.startswith(prefix):
            connection = "postgresql+psycopg://" + connection[len(prefix):]
            break
    os.environ["DATABASE_URL"] = connection
    os.environ.setdefault("AUTH_COOKIE_SECURE", "true")

    model_path = Path(os.environ.get("EYE_MODEL_PATH", "/app/models/eye_detector.pt"))
    model_url = os.environ.get("EYE_MODEL_URL")
    if model_url:
        checksum = os.environ.get("EYE_MODEL_SHA256", "").lower()
        if urlparse(model_url).scheme != "https" or len(checksum) != 64:
            raise RuntimeError("EYE_MODEL_URL harus HTTPS dan EYE_MODEL_SHA256 wajib diisi")
        model_path.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        with urllib.request.urlopen(model_url, timeout=60) as response, model_path.open("wb") as target:
            while chunk := response.read(1024 * 1024):
                digest.update(chunk)
                target.write(chunk)
        if digest.hexdigest() != checksum:
            model_path.unlink()
            raise RuntimeError("Checksum model tidak cocok")
    if not model_path.is_file():
        raise RuntimeError("Model mata belum tersedia: isi EYE_MODEL_URL dan EYE_MODEL_SHA256 atau mount EYE_MODEL_PATH")
    os.environ["EYE_MODEL_PATH"] = str(model_path)
    subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"], check=True)
    if os.environ.get("DATA_SOURCE", "simulation") == "database":
        subprocess.run([sys.executable, "-m", "selamate_backend.seed"], check=True)
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn", "selamate_backend.main:app", "--host", "0.0.0.0", "--port", os.environ.get("PORT", "3001"), "--workers", "1", "--proxy-headers"])


if __name__ == "__main__":
    main()
