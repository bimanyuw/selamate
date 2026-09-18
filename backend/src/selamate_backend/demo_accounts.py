"""Create or repair the two public demo accounts shown by the frontend."""
from uuid import uuid4

from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import select

from .auth import hasher
from .database import SessionLocal
from .models import User

ACCOUNTS = [
    ("Admin", "Admin Demo", "admin@selamate.demo", "BMsa9WScdZTH4_5C"),
    ("Driver", "Driver Demo", "driver@selamate.demo", "QYpOBx8sn6RTb0Wz"),
]


def main():
    with SessionLocal.begin() as db:
        for role, name, email, password in ACCOUNTS:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(
                    id=str(uuid4()),
                    name=name,
                    email=email,
                    role=role,
                    password_hash=hasher.hash(password),
                )
                db.add(user)
            else:
                try:
                    password_matches = hasher.verify(user.password_hash, password)
                except (InvalidHashError, VerificationError):
                    password_matches = False
                if not password_matches or hasher.check_needs_rehash(user.password_hash):
                    user.password_hash = hasher.hash(password)
            user.name = name
            user.role = role
    print("Akun demo Admin dan Driver sudah sinkron dengan kredensial di halaman login.")


if __name__ == "__main__":
    main()
