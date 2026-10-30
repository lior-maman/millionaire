"""
Finished-game results (`results` collection) and the leaderboard built from them.

Document shape — one per finished game:
{
  "user_id": ObjectId(...),
  "activity_id": "...", "activity_name": "General Knowledge",
  "correct": 11, "total": 15,
  "finishedAt": datetime
}

Only games that reach the end are saved. A game abandoned mid-way is not
recorded, so the ranking uses each player's BEST game (abandoning can't
improve it) with the average as a tie-breaker.
"""
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from .database import get_db


def _results():
    return get_db()["results"]


async def ensure_indexes() -> None:
    await _results().create_index([("activity_id", 1), ("user_id", 1)])


async def save_result(user_id: str, result: dict[str, Any]) -> dict[str, Any]:
    doc = {
        "user_id": ObjectId(user_id),
        **result,
        "finishedAt": datetime.now(timezone.utc),
    }
    await _results().insert_one(doc)
    return {**result, "finishedAt": doc["finishedAt"].isoformat()}


async def leaderboard(activity_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """
    One row per player: best score, games played, average, last played.
    Sorted by best score, then average, then games played. Deleted users drop
    out automatically (the user lookup finds nothing).
    """
    match = {"activity_id": activity_id} if activity_id else {}
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$user_id",
                "best": {"$max": "$correct"},
                "total": {"$max": "$total"},
                "games": {"$sum": 1},
                "avg": {"$avg": "$correct"},
                "last": {"$max": "$finishedAt"},
            }
        },
        {"$lookup": {"from": "users", "localField": "_id", "foreignField": "_id", "as": "u"}},
        {"$unwind": "$u"},
        {"$sort": {"best": -1, "avg": -1, "games": -1}},
        {"$limit": limit},
    ]
    rows = []
    async for r in _results().aggregate(pipeline):
        rows.append(
            {
                "user_id": str(r["_id"]),
                "name": r["u"].get("name") or r["u"].get("email", "").split("@")[0],
                "best": r["best"],
                "total": r["total"],
                "games": r["games"],
                "avg": round(r["avg"], 1),
                "last": r["last"].isoformat() if r.get("last") else None,
            }
        )
    return rows
