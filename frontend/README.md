# Millionaire — Frontend (React + Vite)

The user interface for the "Who Wants to Be a Millionaire" game. Consumes the
FastAPI backend, renders right-to-left (the trivia questions are in Hebrew), in
the dark-blue-and-gold style of the original Pygame versions.

## Screens

1. **Activity selection** (`StartScreen`) — a dropdown to choose an activity
   (loaded from `GET /api/activities`) and a "Start game" button.
2. **Game** (`GameScreen`) — 15 questions, a 30-second timer per question, a
   **prize ladder** (₪100 → ₪1,000,000) that marks the current rung, green/red
   answer feedback (the correct index comes from the server), and an end screen
   with "Play again".
   - **Correct answer** → climb one rung on the ladder.
   - **Wrong answer or timeout** → no ladder progress, but **continue** to the
     next question.
   - The game ends only after question 15. The prize is the highest rung reached
     (number of correct answers).
   - **Lifelines** (once per game): **50:50** hides two wrong options;
     **Ask the Audience** shows a bar chart of vote percentages (the majority is
     correct 80% of the time).
   - The 4 options are shuffled per game — positions are not fixed.
3. **Question management** (`AdminScreen`) — add/remove activities; add/edit/remove
   questions; a per-level question count with a warning flag (⚠) when a level
   drops below 5.

## Structure

```
frontend/
├── index.html
├── vite.config.js        proxies /api to localhost:8000 in development
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx           routing between the three screens
    ├── api.js            fetch wrapper for all endpoints
    ├── prizes.js         the 15-rung prize ladder
    ├── styles.css        dark-blue/gold theme, RTL
    └── screens/
        ├── StartScreen.jsx
        ├── GameScreen.jsx
        ├── PrizeLadder.jsx
        └── AdminScreen.jsx
```

## Running (on your machine)

> The code was written in a sandboxed environment that cannot run npm/vite. Run
> it on your own machine.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Make sure the backend is running alongside on port 8000 (see `backend/README.md`).
Vite's proxy forwards `/api` calls to the server, so no extra CORS configuration
is needed in development.

For a production build: `npm run build`. If the backend is on a different domain,
set `VITE_API_BASE` (e.g. `VITE_API_BASE=https://api.example.com`) at build time.

## Connecting to the backend

All calls live in `src/api.js`. If you change paths or ports on the backend, that
is the only place you need to update.
