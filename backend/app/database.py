"""
MongoDB connection using Motor (async driver).

The client is created on FastAPI startup and closed on shutdown. Everything
downstream (services, routes) reads collections from `get_db()`.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings


class _Mongo:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


_mongo = _Mongo()


async def connect_to_mongo() -> None:
    """Open the connection pool. Called on app startup."""
    _mongo.client = AsyncIOMotorClient(settings.mongodb_uri)
    _mongo.db = _mongo.client[settings.mongodb_db]
    # Fail fast if the server is unreachable, so misconfig is obvious at boot.
    await _mongo.client.admin.command("ping")


async def close_mongo_connection() -> None:
    """Close the connection pool. Called on app shutdown."""
    if _mongo.client is not None:
        _mongo.client.close()
        _mongo.client = None
        _mongo.db = None


def get_db() -> AsyncIOMotorDatabase:
    """Return the active database. Raises if called before startup."""
    if _mongo.db is None:
        raise RuntimeError("MongoDB is not connected. Did startup run?")
    return _mongo.db


def activities_collection():
    """The single collection holding activity documents."""
    return get_db()["activities"]
