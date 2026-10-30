"""
Passwords, session tokens and the FastAPI guards that use them.

- Passwords: bcrypt, cost 12.
- Tokens: stateless and signed with HMAC-SHA256 (stdlib, no JWT dependency):
      base64(user_id|expiry) + "." + signature
  The token carries only WHO you are and WHEN it expires. Role and active
  status are read from Mongo on every request, so disabling a user or removing
  their admin role takes effect immediately — no waiting for the token to expire.
- Login rate limit: a few failed attempts per IP+email per window, in memory.
"""
import base64
import hashlib
import hmac
import time
from typing import Any

import bcrypt
from fastapi import Header, HTTPException

from .config import settings


# --- Passwords -------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """Malformed hashes fail closed."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# --- Tokens ----------------------------------------------------------------

def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _sign(body: str) -> str:
    mac = hmac.new(settings.session_secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256)
    return _b64(mac.digest())


def issue_token(user_id: str) -> str:
    exp = int(time.time()) + settings.session_ttl
    body = _b64(f"{user_id}|{exp}".encode("utf-8"))
    return f"{body}.{_sign(body)}"


def verify_token(token: str) -> str | None:
    """Return the user id if the token is correctly signed and unexpired."""
    try:
        body, sig = token.split(".", 1)
    except (ValueError, AttributeError):
        return None
    if not hmac.compare_digest(sig, _sign(body)):
        return None
    try:
        pad = "=" * (-len(body) % 4)
        user_id, exp = base64.urlsafe_b64decode(body + pad).decode("utf-8").split("|", 1)
        if int(exp) < int(time.time()):
            return None
        return user_id
    except (ValueError, TypeError):
        return None


# --- Guards (FastAPI dependencies) -----------------------------------------

async def require_user(authorization: str = Header(default="")) -> dict[str, Any]:
    """Any signed-in, active user. Returns the public user dict."""
    from . import users_repo  # local import: users_repo imports this module

    token = authorization[7:] if authorization.lower().startswith("bearer ") else ""
    user_id = verify_token(token) if token else None
    doc = await users_repo.get_doc(user_id) if user_id else None
    if not doc or doc.get("active") is not True:
        raise HTTPException(status_code=401, detail="Please sign in")
    return users_repo.public(doc)


async def require_admin(authorization: str = Header(default="")) -> dict[str, Any]:
    user = await require_user(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


# --- Login rate limit ------------------------------------------------------

LOGIN_MAX_FAILS = 7
LOGIN_WINDOW_SECS = 300
_login_fails: dict[str, list[float]] = {}


def login_rate_key(forwarded_for: str | None, client_host: str | None, email: str) -> str:
    # Behind nginx / Cloud Run the real client IP is the first X-Forwarded-For entry.
    ip = (forwarded_for or "").split(",")[0].strip() or client_host or "?"
    return f"{ip}|{(email or '').strip().lower()}"


def login_blocked(key: str) -> bool:
    now = time.monotonic()
    hits = [t for t in _login_fails.get(key, []) if now - t < LOGIN_WINDOW_SECS]
    _login_fails[key] = hits
    return len(hits) >= LOGIN_MAX_FAILS


def record_login_fail(key: str) -> None:
    if len(_login_fails) > 10_000:  # crude memory cap
        _login_fails.clear()
    _login_fails.setdefault(key, []).append(time.monotonic())


def clear_login_fails(key: str) -> None:
    _login_fails.pop(key, None)
