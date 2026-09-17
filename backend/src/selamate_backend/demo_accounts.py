"""Create two local demo accounts with stable, generated credentials."""
import json
import secrets
from uuid import uuid4
from sqlalchemy import select
from .auth import hasher
from .config import ROOT
from .database import SessionLocal
from .models import User

ACCOUNTS = [("Admin", "Admin Demo", "admin@selamate.demo"), ("Driver", "Driver Demo", "driver@selamate.demo")]


def main():
    destination = ROOT / ".tmp" / "demo-accounts.json"
    credentials = json.loads(destination.read_text(encoding="utf-8")) if destination.exists() else {}
    with SessionLocal.begin() as db:
        for role, name, email in ACCOUNTS:
            user = db.scalar(select(User).where(User.email == email))
            entry = credentials.get(role)
            if user is not None and (not entry or entry.get("email") != email or user.name != name):
                raise RuntimeError(f"Akun {email} sudah ada tanpa kredensial demo yang cocok; akun tidak diubah.")
            if not entry:
                entry = {"email": email, "password": secrets.token_urlsafe(12)}
                credentials[role] = entry
            if user is None:
                user = User(id=str(uuid4()), name=name, email=email, role=role, password_hash=hasher.hash(entry["password"]))
                db.add(user)
            elif not hasher.verify(user.password_hash, entry["password"]):
                raise RuntimeError(f"Password akun {email} berbeda; akun tidak diubah.")
            user.role = role
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(credentials, indent=2) + "\n", encoding="utf-8")
    print("Dua akun demo siap. Email/password tersimpan di .tmp/demo-accounts.json (diabaikan Git).")


if __name__ == "__main__":
    main()
