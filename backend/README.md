# Millionaire — Backend (FastAPI + MongoDB)

The API server for the "Who Wants to Be a Millionaire" game. Reads questions from
MongoDB, generates a 15-question game (5 random questions per difficulty level),
checks answers, and manages the question bank — without exposing the correct
answer to React.

## Structure

```
backend/
├── app/
│   ├── config.py        settings + environment variables (.env)
│   ├── models.py        Pydantic schemas
│   ├── database.py      Motor (async) connection to MongoDB
│   ├── game_service.py  generation logic + answer checking + lifelines
│   ├── main.py          FastAPI application + endpoints
│   └── seed.py          bank seeding (activities + 30 questions each)
├── requirements.txt
└── .env.example
```

## Game rules (locked)

- **Activity** = 30 questions in Mongo, 10 per level (easy / medium / hard).
- **Game generation** = draw **5 random questions per level** → 15 questions per game.
- Each question = **4 options, exactly one correct**. Option order is **shuffled
  randomly per game** (server-side), and `correct_index` is updated accordingly —
  so the position is never fixed.
- The correct answer is **not sent** to React; checking happens on the server via `/api/answers`.
- **Lifelines** (once per game, computed server-side so the answer is not exposed):
  - **50:50** — hides 2 wrong options.
  - **Ask the Audience** — returns vote percentages; the majority points at the
    correct answer 80% of the time.

## Running (on your machine)

> Note: the code was written in a sandboxed environment that cannot run a server
> or connect to Mongo. Run the steps below on your own machine.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # edit if needed (Atlas / different port)

# Make sure MongoDB is running (local or Atlas), then seed the bank:
python -m app.seed          # prints the created activity ids

# Start the server:
uvicorn app.main:app --reload --port 8000
```

Quick check: open http://localhost:8000/docs for the Swagger UI.

## Endpoints

### Play

| Method | Path | Description |
|---|---|---|
| GET | `/api/activities` | list activities (for the menu / dropdown) |
| GET | `/api/activities/{id}` | full activity + per-level question counts |
| POST | `/api/games` | body `{ "activity_id": "..." }` → a 15-question game |
| POST | `/api/answers` | body `{ "game_id", "question_id", "selected_index" }` → result |
| POST | `/api/lifelines/fifty-fifty` | body `{ "game_id", "question_id" }` → `{ hidden: [i, j] }` (2 wrong options to hide) |
| POST | `/api/lifelines/audience` | body `{ "game_id", "question_id" }` → `{ percentages: [..] }` (sums to 100) |
| DELETE | `/api/games/{game_id}` | forget a finished game |

### Question bank management

All management endpoints require the header `X-Admin-Secret: <ADMIN_SECRET>`
(from the environment). A missing/wrong secret returns `401`. Play/read
endpoints above are open.

| Method | Path | Description |
|---|---|---|
| GET | `/api/activities/{id}` | full activity + per-level counts (guarded) |
| POST | `/api/activities` | create an activity `{ "name", "questions": [] }` |
| DELETE | `/api/activities/{id}` | delete an activity |
| POST | `/api/activities/{id}/questions` | add a question |
| PUT | `/api/activities/{id}/questions/{qid}` | edit a question |
| DELETE | `/api/activities/{id}/questions/{qid}` | delete a question |

Question body (add/edit): `{ "text", "options": [4], "correct_index": 0-3, "difficulty": "easy|medium|hard" }`.

**Deletion policy (warning-only):** questions can be deleted freely. If a level
drops below 5 questions, generating a game from that activity fails with the
message: "Cannot generate a game — level '...' needs at least 5 questions".
`GET /api/activities/{id}` returns `level_counts` with a `playable` flag per
level, so the admin UI can flag understocked levels.

## Seed data

`python -m app.seed` creates **two activities**, each with 30 questions (10 per level):
- **General Knowledge** — science, geography, history
- **Sports & Entertainment** — sports, film, music

The trivia questions themselves are in Hebrew (the game's content).
