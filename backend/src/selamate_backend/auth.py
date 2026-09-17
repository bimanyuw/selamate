"""Persistent authentication using hashed passwords and revocable cookies."""
from collections import deque
import hashlib
import logging
import re
import secrets
from threading import Lock
from time import monotonic, time
from typing import Annotated
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from .config import settings
from .database import get_session
from .models import AuthSession, User

COOKIE = "selamate_session"
hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
_dummy_hash = hasher.hash(secrets.token_urlsafe(32))
router = APIRouter(prefix="/auth", tags=["Authentication"])
Database = Annotated[Session, Depends(get_session)]
_attempts: dict[str, deque] = {}
_attempts_lock = Lock()


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Alamat email tidak valid")
        return value


class RegisterRequest(LoginRequest):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        if not value.strip():
            raise ValueError("Nama wajib diisi")
        return value.strip()


def public_user(user):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def _digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _database_error(db):
    db.rollback()
    logging.getLogger(__name__).error("Authentication database unavailable")
    return HTTPException(503, "Database akun belum tersedia. Jalankan PostgreSQL dan npm.cmd run db:migrate.")


def _origin(request):
    origin = request.headers.get("origin")
    allowed = {str(request.base_url).rstrip("/"), *settings.cors_origins}
    if origin and origin not in allowed:
        raise HTTPException(403, "Origin autentikasi tidak diizinkan")
    if settings.auth_cookie_samesite == "none" and not settings.auth_cookie_secure:
        raise HTTPException(503, "AUTH_COOKIE_SAMESITE=none memerlukan AUTH_COOKIE_SECURE=true")


def _limit(request):
    address = request.client.host if request.client else "unknown"
    now = monotonic()
    with _attempts_lock:
        for key in list(_attempts):
            while _attempts[key] and _attempts[key][0] < now - 300:
                _attempts[key].popleft()
            if not _attempts[key]:
                del _attempts[key]
        if address not in _attempts and len(_attempts) >= 1024:
            raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi nanti.")
        bucket = _attempts.setdefault(address, deque())
        if len(bucket) >= 30:
            raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi dalam 5 menit.")
        bucket.append(now)


def _issue(db, user, request, response):
    now = int(time())
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
    old_token = request.cookies.get(COOKIE)
    if old_token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == _digest(old_token)))
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token_hash=_digest(token), user_id=user.id, expires_at=now + settings.auth_session_seconds))
    result = public_user(user)
    db.commit()
    response.set_cookie(COOKIE, token, max_age=settings.auth_session_seconds, httponly=True,
                        secure=settings.auth_cookie_secure, samesite=settings.auth_cookie_samesite, path="/")
    response.headers["Cache-Control"] = "no-store"
    return result


def get_current_user(request: Request, db: Database):
    _origin(request)
    token = request.cookies.get(COOKIE)
    if not token or len(token) > 128:
        raise HTTPException(401, "Silakan login terlebih dahulu")
    try:
        auth_session = db.get(AuthSession, _digest(token))
        user = db.get(User, auth_session.user_id) if auth_session and auth_session.expires_at > time() else None
    except SQLAlchemyError as exc:
        raise _database_error(db) from exc
    if user is None:
        raise HTTPException(401, "Sesi berakhir. Silakan login kembali")
    return user


def admin_user(user: Annotated[User, Depends(get_current_user)]):
    if user.role != "Admin":
        raise HTTPException(403, "Akses khusus Admin")
    return user


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response, db: Database):
    _origin(request); _limit(request)
    try:
        user = User(id=str(uuid4()), name=payload.name, email=payload.email, password_hash=hasher.hash(payload.password))
        db.add(user); db.flush()
        return _issue(db, user, request, response)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Email sudah terdaftar. Silakan login.") from exc
    except SQLAlchemyError as exc:
        raise _database_error(db) from exc


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Database):
    _origin(request); _limit(request)
    try:
        user = db.scalar(select(User).where(User.email == payload.email))
        try:
            hasher.verify(user.password_hash if user else _dummy_hash, payload.password)
        except (VerificationError, InvalidHashError):
            raise HTTPException(401, "Email atau password salah")
        if user is None:
            raise HTTPException(401, "Email atau password salah")
        if hasher.check_needs_rehash(user.password_hash):
            user.password_hash = hasher.hash(payload.password)
        return _issue(db, user, request, response)
    except SQLAlchemyError as exc:
        raise _database_error(db) from exc


@router.get("/me")
def me(response: Response, user: Annotated[User, Depends(get_current_user)]):
    response.headers["Cache-Control"] = "no-store"
    return public_user(user)


@router.post("/logout")
def logout(request: Request, response: Response, db: Database):
    _origin(request)
    token = request.cookies.get(COOKIE)
    try:
        if token:
            db.execute(delete(AuthSession).where(AuthSession.token_hash == _digest(token)))
            db.commit()
    except SQLAlchemyError as exc:
        raise _database_error(db) from exc
    response.delete_cookie(COOKIE, path="/", secure=settings.auth_cookie_secure, httponly=True, samesite=settings.auth_cookie_samesite)
    response.headers["Cache-Control"] = "no-store"
    return {"status": "logged_out"}
