"""
Game service: the heart of the mechanic.

Responsibilities:
  1. List activities (for menu screens) and read one activity in full.
  2. Generate a game from an activity — draw 5 RANDOM questions per difficulty
     (easy/medium/hard) => 15 questions total, correct answer stripped out.
  3. Check a submitted answer server-side, and keep the score server-side.
  4. Admin CRUD: add/remove activities, add/edit/remove questions.

Generated games are held in memory keyed by game_id. That keeps the correct
answers off the client while a game is in progress. For production you'd move
this store to Redis or a Mongo `games` collection; the interface stays the same.

Scoring: each game belongs to the user who created it, and each question can be
answered ONCE (the first answer counts). The server counts correct answers
itself, so the score saved to the leaderboard can't be inflated by the client.
"""
import random
import uuid

from bson import ObjectId
from bson.errors import InvalidId

from .config import settings
from .database import activities_collection
from .models import (
    ActivityDetail,
    ActivityInput,
    ActivitySummary,
    Game,
    GameQuestion,
    LevelCount,
    QuestionInDB,
    QuestionInput,
)

# In-memory store: game_id -> { question_id: correct_index }
# Only the answer key lives here; the questions themselves go to the client.
_answer_keys: dict[str, dict[str, int]] = {}
# game_id -> owner + live score:
#   { user_id, activity_id, activity_name, answered: set[qid], correct: int }
_games: dict[str, dict] = {}


def _oid(activity_id: str) -> ObjectId:
    try:
        return ObjectId(activity_id)
    except (InvalidId, TypeError):
        raise ValueError(f"invalid activity id: {activity_id!r}")


def _owned_game(game_id: str, user_id: str) -> dict:
    """The game's state, or ValueError if it doesn't exist / isn't this user's."""
    game = _games.get(game_id)
    if game is None or game["user_id"] != user_id:
        raise ValueError("unknown or expired game")
    return game


async def list_activities() -> list[ActivitySummary]:
    """Return all activities with their question counts, for menu display."""
    cursor = activities_collection().find({}, {"name": 1, "questions": 1})
    out: list[ActivitySummary] = []
    async for doc in cursor:
        out.append(
            ActivitySummary(
                id=str(doc["_id"]),
                name=doc["name"],
                question_count=len(doc.get("questions", [])),
            )
        )
    return out


async def generate_game(activity_id: str, user_id: str) -> Game:
    """
    Build a game from an activity: 5 random questions per difficulty level.
    Raises ValueError if the activity is missing or a level is understocked.
    """
    doc = await activities_collection().find_one({"_id": _oid(activity_id)})
    if doc is None:
        raise ValueError("activity not found")

    all_questions = doc.get("questions", [])
    per_level = settings.questions_per_level

    picked: list[dict] = []
    for level in settings.difficulties:
        pool = [q for q in all_questions if q.get("difficulty") == level]
        if len(pool) < per_level:
            raise ValueError(
                f"Cannot generate a game — level '{level}' needs at least "
                f"{per_level} questions (currently has {len(pool)})."
            )
        picked.extend(random.sample(pool, per_level))

    game_id = uuid.uuid4().hex

    # Shuffle each question's 4 options so their position is randomized per game.
    # We track where the correct answer lands and store THAT in the answer key,
    # so server-side checking stays correct and the client never sees the answer.
    answer_key: dict[str, int] = {}
    game_questions: list[GameQuestion] = []
    for i, q in enumerate(picked):
        order = list(range(len(q["options"])))
        random.shuffle(order)
        shuffled_options = [q["options"][j] for j in order]
        new_correct = order.index(q["correct_index"])

        answer_key[q["id"]] = new_correct
        game_questions.append(
            GameQuestion(
                id=q["id"],
                text=q["text"],
                options=shuffled_options,
                difficulty=q["difficulty"],
                order=i,
            )
        )

    _answer_keys[game_id] = answer_key
    _games[game_id] = {
        "user_id": user_id,
        "activity_id": activity_id,
        "activity_name": doc["name"],
        "answered": set(),
        "correct": 0,
    }

    return Game(
        game_id=game_id,
        activity_id=activity_id,
        activity_name=doc["name"],
        questions=game_questions,
        total=len(game_questions),
    )


def check_answer(
    game_id: str, question_id: str, selected_index: int, user_id: str
) -> tuple[bool, int]:
    """
    Validate an answer against the stored key and update the server-side score.
    Returns (is_correct, correct_index). Raises ValueError on unknown game,
    foreign game, unknown question, or a second answer to the same question.
    """
    game = _owned_game(game_id, user_id)
    key = _answer_keys[game_id]
    if question_id not in key:
        raise ValueError("question does not belong to this game")
    if question_id in game["answered"]:
        raise ValueError("question already answered")

    correct_index = key[question_id]
    correct = selected_index == correct_index
    game["answered"].add(question_id)
    if correct:
        game["correct"] += 1
    return (correct, correct_index)


def finish_game(game_id: str, user_id: str) -> dict:
    """
    End a game and return its final result for saving. Unanswered questions
    (timeouts) count as wrong. The game is removed, so it can be finished once.
    """
    game = _owned_game(game_id, user_id)
    total = len(_answer_keys[game_id])
    forget_game(game_id, user_id)
    return {
        "activity_id": game["activity_id"],
        "activity_name": game["activity_name"],
        "correct": game["correct"],
        "total": total,
    }


def forget_game(game_id: str, user_id: str) -> None:
    """Drop a game's answer key from memory (only the owner may)."""
    game = _games.get(game_id)
    if game is None or game["user_id"] != user_id:
        return
    _answer_keys.pop(game_id, None)
    _games.pop(game_id, None)


# --- Lifelines ------------------------------------------------------------
# Both lifelines run server-side because they depend on the correct index,
# which the client never receives. They do not reveal the answer directly.

_NUM_OPTIONS = 4
AUDIENCE_CORRECT_PROBABILITY = 0.8  # 80% of the time the poll points at the answer


def _correct_for(game_id: str, question_id: str, user_id: str) -> int:
    _owned_game(game_id, user_id)
    key = _answer_keys[game_id]
    if question_id not in key:
        raise ValueError("question does not belong to this game")
    return key[question_id]


def fifty_fifty(game_id: str, question_id: str, user_id: str) -> list[int]:
    """
    Return the indices of two WRONG options to hide, leaving the correct one
    and one random distractor. Does not reveal which of the remaining is correct.
    """
    correct = _correct_for(game_id, question_id, user_id)
    wrong = [i for i in range(_NUM_OPTIONS) if i != correct]
    return random.sample(wrong, 2)


def ask_audience(game_id: str, question_id: str, user_id: str) -> list[int]:
    """
    Return audience vote percentages per option (sums to 100). 80% of the time
    the highest bar is the correct answer; 20% of the time the audience is
    "wrong" and favors a random distractor. Never states the answer outright.
    """
    correct = _correct_for(game_id, question_id, user_id)

    if random.random() < AUDIENCE_CORRECT_PROBABILITY:
        favored = correct
    else:
        favored = random.choice([i for i in range(_NUM_OPTIONS) if i != correct])

    # Give the favored option a clear plurality (50–70%), split the rest.
    stats = [0] * _NUM_OPTIONS
    stats[favored] = random.randint(50, 70)
    remaining = 100 - stats[favored]
    others = [i for i in range(_NUM_OPTIONS) if i != favored]
    for idx, i in enumerate(others):
        if idx == len(others) - 1:
            stats[i] = remaining
        else:
            val = random.randint(0, remaining)
            stats[i] = val
            remaining -= val
    return stats


# --- Admin / CRUD ---------------------------------------------------------

def _level_counts(questions: list[dict]) -> list[LevelCount]:
    """Per-difficulty counts, flagging which levels have enough to play."""
    out: list[LevelCount] = []
    for level in settings.difficulties:
        count = sum(1 for q in questions if q.get("difficulty") == level)
        out.append(
            LevelCount(
                difficulty=level,
                count=count,
                playable=count >= settings.questions_per_level,
            )
        )
    return out


def _next_question_id(questions: list[dict]) -> str:
    """Generate a short unique question id that won't collide within an activity."""
    return "q_" + uuid.uuid4().hex[:8]


async def get_activity(activity_id: str) -> ActivityDetail:
    """Full activity for the admin editor, with per-level counts."""
    doc = await activities_collection().find_one({"_id": _oid(activity_id)})
    if doc is None:
        raise ValueError("activity not found")
    questions = doc.get("questions", [])
    return ActivityDetail(
        id=str(doc["_id"]),
        name=doc["name"],
        questions=[QuestionInDB(**q) for q in questions],
        level_counts=_level_counts(questions),
    )


async def create_activity(payload: ActivityInput) -> ActivitySummary:
    """Add a new activity (optionally with starter questions)."""
    questions = []
    for q in payload.questions:
        questions.append({"id": _next_question_id(questions), **q.model_dump()})
    doc = {"name": payload.name, "questions": questions}
    result = await activities_collection().insert_one(doc)
    return ActivitySummary(
        id=str(result.inserted_id), name=payload.name, question_count=len(questions)
    )


async def delete_activity(activity_id: str) -> None:
    """Remove an activity entirely."""
    result = await activities_collection().delete_one({"_id": _oid(activity_id)})
    if result.deleted_count == 0:
        raise ValueError("activity not found")


async def add_question(activity_id: str, payload: QuestionInput) -> QuestionInDB:
    """Append a question to an activity's bank."""
    oid = _oid(activity_id)
    doc = await activities_collection().find_one({"_id": oid}, {"questions.id": 1})
    if doc is None:
        raise ValueError("activity not found")

    new_q = {"id": _next_question_id(doc.get("questions", [])), **payload.model_dump()}
    await activities_collection().update_one(
        {"_id": oid}, {"$push": {"questions": new_q}}
    )
    return QuestionInDB(**new_q)


async def update_question(
    activity_id: str, question_id: str, payload: QuestionInput
) -> QuestionInDB:
    """Edit an existing question in place."""
    oid = _oid(activity_id)
    updated = {"id": question_id, **payload.model_dump()}
    result = await activities_collection().update_one(
        {"_id": oid, "questions.id": question_id},
        {"$set": {"questions.$": updated}},
    )
    if result.matched_count == 0:
        raise ValueError("activity or question not found")
    return QuestionInDB(**updated)


async def delete_question(activity_id: str, question_id: str) -> None:
    """Remove a question. Allowed even if it drops a level below playable count
    (warning-only policy): game generation will surface a clear error later."""
    oid = _oid(activity_id)
    result = await activities_collection().update_one(
        {"_id": oid}, {"$pull": {"questions": {"id": question_id}}}
    )
    if result.matched_count == 0:
        raise ValueError("activity not found")
