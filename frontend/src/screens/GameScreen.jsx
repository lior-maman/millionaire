import { useEffect, useRef, useState } from "react";
import {
  createGame,
  submitAnswer,
  forgetGame,
  fiftyFifty,
  askAudience,
} from "../api.js";
import { PRIZES, formatPrize } from "../prizes.js";
import PrizeLadder from "./PrizeLadder.jsx";
import FiftyFiftyIcon from "../icons/FiftyFiftyIcon.jsx";
import AudienceIcon from "../icons/AudienceIcon.jsx";
import TrophyIcon from "../icons/TrophyIcon.jsx";
import TimerIcon from "../icons/TimerIcon.jsx";

const QUESTION_TIME = 30; // seconds per question

const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };

/**
 * Game screen: fetches a generated game for the chosen activity, then walks the
 * player through its 15 questions. A per-question countdown, answer feedback
 * (right/wrong revealed by the server), a prize ladder, and an end screen.
 *
 * A wrong answer (or a timeout) does NOT end the game — the player moves on to
 * the next question, but the ladder does not advance. The game ends only after
 * the last question. The prize is the amount at the highest rung reached, i.e.
 * the number of correct answers.
 *
 * Answer correctness is decided server-side via submitAnswer — the client never
 * receives the correct index up front.
 */
export default function GameScreen({ activity, onExit }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [index, setIndex] = useState(0);          // current question index
  const [correctCount, setCorrectCount] = useState(0); // rungs climbed
  const [locked, setLocked] = useState(false);    // true after answering, until next
  const [picked, setPicked] = useState(null);     // selected option index
  const [correctIndex, setCorrectIndex] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [status, setStatus] = useState("loading"); // loading|playing|finished

  // Lifelines — each usable once per game.
  const [lifelines, setLifelines] = useState({ fifty: true, audience: true });
  const [hidden, setHidden] = useState([]);        // option indices hidden by 50:50
  const [audience, setAudience] = useState(null);  // percentages array or null

  const timerRef = useRef(null);
  const gameIdRef = useRef(null); // latest game_id, for reliable cleanup

  // Prize = amount at the highest rung reached (0 if none correct yet).
  const prize = correctCount > 0 ? PRIZES[correctCount - 1] : 0;

  // Load a fresh game whenever the activity changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    createGame(activity.id)
      .then((g) => {
        if (cancelled) return;
        setGame(g);
        gameIdRef.current = g.game_id;
        setStatus("playing");
        resetQuestion();
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      // Free the server-side answer key for whatever game is currently loaded.
      if (gameIdRef.current) forgetGame(gameIdRef.current).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id]);

  // Countdown for the current question. Runs only while actively playing and
  // the question is not yet locked (answered).
  useEffect(() => {
    if (status !== "playing" || locked) return;
    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [status, locked, timeLeft]);

  function resetQuestion() {
    setLocked(false);
    setPicked(null);
    setCorrectIndex(null);
    setTimeLeft(QUESTION_TIME);
    // Lifeline effects apply to a single question only.
    setHidden([]);
    setAudience(null);
  }

  // 50:50 — hide two wrong options for the current question.
  async function useFiftyFifty() {
    if (!lifelines.fifty || locked) return;
    try {
      const res = await fiftyFifty(game.game_id, game.questions[index].id);
      setHidden(res.hidden);
      setLifelines((l) => ({ ...l, fifty: false }));
    } catch (e) {
      setError(e.message);
    }
  }

  // Ask the audience — show poll percentages for the current question.
  async function useAudience() {
    if (!lifelines.audience || locked) return;
    try {
      const res = await askAudience(game.game_id, game.questions[index].id);
      setAudience(res.percentages);
      setLifelines((l) => ({ ...l, audience: false }));
    } catch (e) {
      setError(e.message);
    }
  }

  // Move to the next question, or finish the game after the last one.
  function advance() {
    if (index + 1 >= game.questions.length) {
      setStatus("finished");
    } else {
      setIndex((i) => i + 1);
      resetQuestion();
    }
  }

  function handleTimeout() {
    // Time ran out: treat like a wrong answer — no ladder progress, but the
    // game continues to the next question.
    setLocked(true);
    setTimeout(advance, 900);
  }

  async function choose(optionIndex) {
    if (locked || status !== "playing") return;
    const q = game.questions[index];
    setLocked(true);
    setPicked(optionIndex);
    try {
      const res = await submitAnswer(game.game_id, q.id, optionIndex);
      setCorrectIndex(res.correct_index);
      // Climb the ladder only on a correct answer; either way, advance.
      if (res.correct) setCorrectCount((c) => c + 1);
      setTimeout(advance, 900);
    } catch (e) {
      setError(e.message);
      setLocked(false);
    }
  }

  function restart() {
    setIndex(0);
    setCorrectCount(0);
    setLifelines({ fifty: true, audience: true });
    setStatus("loading");
    setLoading(true);
    createGame(activity.id)
      .then((g) => {
        setGame(g);
        gameIdRef.current = g.game_id;
        setStatus("playing");
        resetQuestion();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  if (loading) return <div className="panel"><p className="muted">Loading game…</p></div>;
  if (error)
    return (
      <div className="panel">
        <p className="error">{error}</p>
        <button className="btn" onClick={onExit}>Back</button>
      </div>
    );

  if (status === "finished") {
    const perfect = correctCount === game.questions.length;
    return (
      <div className="panel end-panel">
        {prize > 0 && (
          <div className={perfect ? "end-trophy perfect" : "end-trophy"}>
            <TrophyIcon />
          </div>
        )}
        <h2 className={perfect ? "end-title win" : "end-title"}>
          {perfect ? "Congratulations! You answered every question correctly!" : "Game over"}
        </h2>
        <p className="end-score">
          {prize > 0
            ? `You won ${formatPrize(prize)}`
            : "No prize this time"}
        </p>
        <p className="muted">You answered {correctCount} of {game.questions.length} questions correctly.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={restart}>Play again</button>
          <button className="btn" onClick={onExit}>Choose another activity</button>
        </div>
      </div>
    );
  }

  const q = game.questions[index];
  const total = game.questions.length;

  return (
    <div className="game-layout">
      <aside className="ladder-wrap">
        <PrizeLadder currentIndex={correctCount} answered={correctCount} />
      </aside>

      <div className="panel game-panel">
        <div className="game-header">
          <span className="chip">{activity.name}</span>
          <span className={`chip diff-${q.difficulty}`}>
            {DIFFICULTY_LABEL[q.difficulty]}
          </span>
          <span className="timer-badge" aria-label={`Time remaining: ${timeLeft} seconds`}>
            <TimerIcon seconds={timeLeft} danger={timeLeft <= 10} />
          </span>

          <div className="lifelines">
            <button
              className="lifeline"
              disabled={!lifelines.fifty || locked}
              onClick={useFiftyFifty}
              title="50:50 — remove two wrong answers"
              aria-label="50:50 lifeline — remove two wrong answers"
            >
              <FiftyFiftyIcon />
            </button>
            <button
              className="lifeline"
              disabled={!lifelines.audience || locked}
              onClick={useAudience}
              title="Ask the Audience"
              aria-label="Ask the Audience lifeline"
            >
              <AudienceIcon />
            </button>
          </div>
        </div>

        <div className="question-box" dir="auto">{q.text}</div>

        <div className="options-grid">
          {q.options.map((opt, i) => {
            if (hidden.includes(i)) {
              // Hidden by 50:50 — keep the grid cell but show it empty/disabled.
              return <div key={i} className="option hidden-opt" aria-hidden="true" />;
            }
            let cls = "option";
            if (locked && correctIndex !== null) {
              if (i === correctIndex) cls += " correct";
              else if (i === picked) cls += " wrong";
            }
            return (
              <button
                key={i}
                className={cls}
                dir="auto"
                disabled={locked}
                onClick={() => choose(i)}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {audience && (
          <div className="audience">
            <p className="audience-title">Audience poll results:</p>
            <div className="audience-bars">
              {audience.map((pct, i) => (
                <div key={i} className="audience-col">
                  <div className="audience-bar-track">
                    <div
                      className="audience-bar-fill"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="audience-pct">{pct}%</span>
                  <span className="audience-label">{["A", "B", "C", "D"][i]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
