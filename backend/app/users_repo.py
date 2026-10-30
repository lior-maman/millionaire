"""
User accounts in MongoDB (`users` collection, same database as the activities).

Document shape:
{
  "_id": ObjectId(...),
  "email": "dana@example.com",      # stored lower-cased, unique index
  "name": "Dana",
  "password": "$2b$12$...",         # bcrypt hash — never sent to the client
  "role": "player" | "admin",
  "active": true,                   # false = cannot sign in, sessions stop working
  "createdAt": datetime,
  "lastLoginAt": datetime | None
}
"""
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError

from .auth import hash_password
from .database import get_db

ROLES = ("player", "admin")


def _users():
    return get_db()["users"]


def _oid(user_id: str) -> ObjectId | None:
    try:
        return ObjectId(user_id)
    except (InvalidId, TypeError):
        return None


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def public(doc: dict[str, Any]) -> dict[str, Any]:
    """Shape a user document for the client: string id, and NO password hash."""
    created, last = doc.get("createdAt"), doc.get("lastLoginAt")
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "name": doc.get("name") or "",
        "role": doc.get("role") or "player",
        "active": bool(doc.get("active")),
        "createdAt": created.isoformat() if created else None,
        "lastLoginAt": last.isoformat() if last else None,
    }


async def ensure_indexes() -> None:
    """One account per email (emails are stored lower-cased, so this is
    effectively case-insensitive)."""
    await _users().create_index("email", unique=True)


async def find_by_email(email: str) -> dict[str, Any] | None:
    """Raw document (including the hash) — for login only."""
    return await _users().find_one({"email": _norm_email(email)})


async def get_doc(user_id: str) -> dict[str, Any] | None:
    oid = _oid(user_id)
    return await _users().find_one({"_id": oid}) if oid else None


async def list_users() -> list[dict[str, Any]]:
    cursor = _users().find({}).sort("createdAt", -1)
    return [public(d) async for d in cursor]


async def admin_exists() -> bool:
    return await _users().count_documents({"role": "admin"}, limit=1) > 0


async def create_user(email: str, password: str, name: str = "",
                      role: str = "player", active: bool = True) -> dict[str, Any]:
    """Raises ValueError if the email is already taken."""
    doc = {
        "email": _norm_email(email),
        "name": (name or "").strip(),
        "password": hash_password(password),
        "role": role,
        "active": active,
        "createdAt": datetime.now(timezone.utc),
        "lastLoginAt": None,
    }
    try:
        res = await _users().insert_one(doc)
    except DuplicateKeyError:
        raise ValueError("Email already exists")
    doc["_id"] = res.inserted_id
    return public(doc)


async def update_user(user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Partial update. Returns the updated public user, None if not found.
    Raises ValueError if the new email is already taken."""
    oid = _oid(user_id)
    if oid is None:
        return None
    update: dict[str, Any] = {}
    if data.get("email") is not None:
        update["email"] = _norm_email(data["email"])
    if data.get("name") is not None:
        update["name"] = data["name"].strip()
    if data.get("role") is not None:
        update["role"] = data["role"]
    if data.get("active") is not None:
        update["active"] = bool(data["active"])
    if data.get("password"):  # only re-hash when a new password is provided
        update["password"] = hash_password(data["password"])
    if update:
        try:
            res = await _users().update_one({"_id": oid}, {"$set": update})
        except DuplicateKeyError:
            raise ValueError("Email already exists")
        if res.matched_count == 0:
            return None
    doc = await _users().find_one({"_id": oid})
    return public(doc) if doc else None


async def delete_user(user_id: str) -> bool:
    oid = _oid(user_id)
    if oid is None:
        return False
    res = await _users().delete_one({"_id": oid})
    return res.deleted_count > 0


async def touch_login(user_id: ObjectId) -> None:
    await _users().update_one(
        {"_id": user_id}, {"$set": {"lastLoginAt": datetime.now(timezone.utc)}}
    )
