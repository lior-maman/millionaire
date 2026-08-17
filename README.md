# Who Wants to Be a Millionaire — Full Stack

A trivia game in the style of "Who Wants to Be a Millionaire", built as three services:

- **MongoDB** — the question bank (activities, each with 30 questions across 3 difficulty levels).
- **FastAPI** (Python) — generates a game (5 random questions per level → 15 questions), checks answers, powers lifelines, and manages the bank (CRUD).
- **React** (Vite) — the user interface: pick an activity (dropdown), play, and manage questions.

> **Note on language:** the app's UI, docs, and code are in English. The trivia
> questions themselves are in Hebrew (that is the game's content), and the game
> renders right-to-left to display them correctly.

```
.
├── docker-compose.yml     runs all three services together
├── backend/               FastAPI + Mongo (motor)
│   └── README.md          API details and manual run steps
└── frontend/              React + Vite
    └── README.md          UI details and manual run steps
```

## Quick start — everything together (recommended)

Only requirement: Docker + Docker Compose installed.

```bash
docker compose up --build
```

- **Game:** http://localhost:8080
- **API docs (Swagger):** http://localhost:8000/docs

On first run, the backend automatically seeds the two activities (only if the
database is empty, via `SEED_ON_STARTUP=true`). Mongo data is stored in a volume
named `mongo_data`, so it survives restarts.

To stop: `docker compose down` (add `-v` to also delete the Mongo data).

## Game rules

- **Activity** = 30 questions in Mongo, 10 per level (easy / medium / hard).
- **Game generation** = draw **5 random questions per level** → 15 questions per
  game, different every round.
- Each question = **4 options, exactly one correct**. Option order is **shuffled
  randomly per game** (server-side), so positions are never fixed.
- The correct answer is never sent to React — checking happens on the server.
- A **wrong answer or timeout does not end the game**: the player moves to the
  next question, but does not climb the prize ladder. The game ends only after
  the last question. The prize is the highest rung reached (number of correct
  answers).
- **Lifelines** (once per game, computed server-side so the answer is never
  exposed): **50:50** hides two wrong options; **Ask the Audience** returns poll
  percentages where the majority points at the correct answer 80% of the time.
- **Bank management** from the UI: add/remove activities and questions.
  Warning-only policy — if a level drops below 5 questions, generating a game
  from that activity fails with a clear message.

## Manual run (without Docker)

For local development, run each service separately — see `backend/README.md` and
`frontend/README.md`. In short: run a local Mongo, `python -m app.seed`,
`uvicorn app.main:app`, and `npm run dev` alongside.

## Architecture

```
React (nginx :8080) ──/api──▶ FastAPI (:8000) ──▶ MongoDB (:27017)
     │  proxies /api                                    │
     └── static files                          volume: mongo_data
```

Under Docker, nginx serves the frontend and proxies `/api` calls to the backend
on the same origin — so no CORS configuration is needed. In local development,
Vite's dev proxy does the same thing.
# millionaire
