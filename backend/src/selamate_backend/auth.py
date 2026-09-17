import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import Cookie, Depends, HTTPException, status

from .config import settings

Role = Literal["Admin", "Driver"]
SESSION_SECONDS = 60 * 60 * 8


@dataclass(frozen=True)
class User:
    id: str
    name: str
    email: str
    role: Role
    salt: bytes
    password_hash: bytes


def _password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


def _make_user(user_id: str, name: str, email: str, password: str, role: Role) -> User:
    salt = secrets.token_bytes(16)
    return User(user_id, name, email, role, salt, _password_hash(password, salt))


USERS = (
    _make_user("admin-1", "Admin Selamate", settings.admin_email, settings.admin_password, "Admin"),
    _make_user("driver-1", "Driver Selamate", settings.driver_email, settings.driver_password, "Driver"),
)


def public_user(user: User) -> dict[str, str]:
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def authenticate(email: str, password: str) -> User | None:
    user = next((item for item in USERS if hmac.compare_digest(item.email.lower(), email.strip().lower())), None)
    if user is None:
        return None
    return user if hmac.compare_digest(user.password_hash, _password_hash(password, user.salt)) else None


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_session(user: User) -> str:
    payload = _encode(json.dumps({"sub": user.id, "exp": int(time.time()) + SESSION_SECONDS}, separators=(",", ":")).encode())
    signature = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_encode(signature)}"


def read_session(token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload, signature = token.split(".", 1)
        expected = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_decode(signature), expected):
            return None
        session = json.loads(_decode(payload))
        if session.get("exp", 0) < int(time.time()):
            return None
        return next((user for user in USERS if user.id == session.get("sub")), None)
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def current_user(selamate_session: Annotated[str | None, Cookie()] = None) -> User:
    user = read_session(selamate_session)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autentikasi diperlukan")
    return user


def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses khusus Admin")
    return user
