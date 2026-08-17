import { useEffect, useState } from "react";
import {
  listActivities,
  getActivity,
  createActivity,
  deleteActivity,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from "../api.js";

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const EMPTY_QUESTION = {
  text: "",
  options: ["", "", "", ""],
  correct_index: 0,
  difficulty: "easy",
};

/**
 * Admin screen: manage the question bank.
 *   - Gated by a password (the admin secret), asked on every entry (not stored).
 *   - list / create / delete activities
 *   - within an activity: view per-level counts, add / edit / delete questions
 *
 * The secret is sent as the X-Admin-Secret header on every management call and
 * verified server-side; hiding the UI alone is not the protection.
 *
 * Deletion is warning-only: a level under 5 questions is flagged (not blocked);
 * game generation surfaces the error at play time.
 */
export default function AdminScreen() {
  const [secret, setSecret] = useState(null);       // set once the password is verified
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(null);

  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [draft, setDraft] = useState(EMPTY_QUESTION);
  const [editingId, setEditingId] = useState(null); // question id being edited

  async function refreshActivities(keepId) {
    const list = await listActivities();
    setActivities(list);
    const nextId = keepId && list.some((a) => a.id === keepId)
      ? keepId
      : list[0]?.id || "";
    setSelectedId(nextId);
  }

  // Load activities only after the password is accepted.
  useEffect(() => {
    if (secret) refreshActivities().catch((e) => setError(e.message));
  }, [secret]);

  useEffect(() => {
    if (!secret || !selectedId) {
      setDetail(null);
      return;
    }
    getActivity(selectedId, secret)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selectedId, secret]);

  // Verify the entered password by attempting an authenticated call.
  // GET /api/activities is open (play needs it), so we validate the secret with
  // a management call: list activities, then fetch one's detail (which is guarded).
  async function submitPassword(e) {
    e.preventDefault();
    setPwError(null);
    const candidate = pwInput.trim();
    if (!candidate) return;
    try {
      const list = await listActivities();
      if (list.length > 0) {
        // getActivity is guarded — a wrong secret throws 401 here.
        await getActivity(list[0].id, candidate);
      }
      setSecret(candidate);   // accepted
      setPwInput("");
    } catch (err) {
      setPwError(
        err.message.includes("admin secret")
          ? "Wrong password."
          : err.message
      );
    }
  }

  async function reloadDetail() {
    if (selectedId) setDetail(await getActivity(selectedId, secret));
    await refreshActivities(selectedId);
  }

  function guard(fn) {
    return async (...args) => {
      setError(null);
      try {
        await fn(...args);
      } catch (e) {
        setError(e.message);
      }
    };
  }

  const onCreateActivity = guard(async () => {
    if (!newActivityName.trim()) return;
    const created = await createActivity(newActivityName.trim(), [], secret);
    setNewActivityName("");
    await refreshActivities(created.id);
  });

  const onDeleteActivity = guard(async () => {
    if (!selectedId) return;
    if (!confirm(`Delete the activity "${detail?.name}" and all its questions?`)) return;
    await deleteActivity(selectedId, secret);
    await refreshActivities();
  });

  const onSubmitQuestion = guard(async (e) => {
    e.preventDefault();
    if (!draft.text.trim() || draft.options.some((o) => !o.trim())) {
      setError("Please fill in the question text and all 4 options.");
      return;
    }
    if (editingId) {
      await updateQuestion(selectedId, editingId, draft, secret);
    } else {
      await addQuestion(selectedId, draft, secret);
    }
    setDraft(EMPTY_QUESTION);
    setEditingId(null);
    await reloadDetail();
  });

  const onEditQuestion = (q) => {
    setEditingId(q.id);
    setDraft({
      text: q.text,
      options: [...q.options],
      correct_index: q.correct_index,
      difficulty: q.difficulty,
    });
  };

  const onDeleteQuestion = guard(async (qid) => {
    if (!confirm("Delete this question?")) return;
    await deleteQuestion(selectedId, qid, secret);
    if (editingId === qid) {
      setEditingId(null);
      setDraft(EMPTY_QUESTION);
    }
    await reloadDetail();
  });

  function setOption(i, value) {
    setDraft((d) => {
      const options = [...d.options];
      options[i] = value;
      return { ...d, options };
    });
  }

  // --- Password gate -------------------------------------------------------
  if (!secret) {
    return (
      <div className="panel start-panel">
        <h2 className="panel-title">Manage questions</h2>
        <p className="muted">Enter the admin password to manage the question bank.</p>
        <form className="field" onSubmit={submitPassword}>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary btn-lg" type="submit">Unlock</button>
        </form>
        {pwError && <p className="error">{pwError}</p>}
      </div>
    );
  }

  return (
    <div className="admin">
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2 className="panel-title">Activities</h2>
        <div className="row wrap">
          <select
            className="select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {activities.length === 0 && <option value="">— no activities —</option>}
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.question_count})
              </option>
            ))}
          </select>
          <button className="btn danger" disabled={!selectedId} onClick={onDeleteActivity}>
            Delete activity
          </button>
        </div>

        <div className="row wrap add-activity">
          <input
            className="input"
            placeholder="New activity name"
            value={newActivityName}
            onChange={(e) => setNewActivityName(e.target.value)}
          />
          <button className="btn btn-primary" onClick={onCreateActivity}>
            Add activity
          </button>
        </div>
      </section>

      {detail && (
        <>
          <section className="panel">
            <h3 className="panel-title">Level status — {detail.name}</h3>
            <div className="row wrap">
              {detail.level_counts.map((lc) => (
                <span
                  key={lc.difficulty}
                  className={lc.playable ? "level-chip ok" : "level-chip low"}
                  title={lc.playable ? "Enough questions" : "Fewer than 5 questions — cannot generate a game"}
                >
                  {DIFFICULTIES.find((d) => d.value === lc.difficulty)?.label}: {lc.count}
                  {!lc.playable && " ⚠"}
                </span>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3 className="panel-title">
              {editingId ? "Edit question" : "Add question"}
            </h3>
            <form className="q-form" onSubmit={onSubmitQuestion}>
              <label className="field">
                <span className="field-label">Question text</span>
                <input
                  className="input"
                  dir="auto"
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </label>

              <div className="options-edit">
                {draft.options.map((opt, i) => (
                  <label key={i} className="option-edit">
                    <input
                      type="radio"
                      name="correct"
                      checked={draft.correct_index === i}
                      onChange={() => setDraft({ ...draft, correct_index: i })}
                      title="Mark as the correct answer"
                    />
                    <input
                      className="input"
                      dir="auto"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p className="muted small">Select the radio button next to the correct answer.</p>

              <label className="field">
                <span className="field-label">Difficulty</span>
                <select
                  className="select"
                  value={draft.difficulty}
                  onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>

              <div className="row">
                <button className="btn btn-primary" type="submit">
                  {editingId ? "Save changes" : "Add question"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setEditingId(null);
                      setDraft(EMPTY_QUESTION);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="panel">
            <h3 className="panel-title">Questions ({detail.questions.length})</h3>
            <ul className="q-list">
              {detail.questions.map((q) => (
                <li key={q.id} className="q-item">
                  <div className="q-item-main">
                    <span className={`level-chip small ${q.difficulty}`}>
                      {DIFFICULTIES.find((d) => d.value === q.difficulty)?.label}
                    </span>
                    <span className="q-text" dir="auto">{q.text}</span>
                  </div>
                  <div className="q-item-actions">
                    <button className="btn small" onClick={() => onEditQuestion(q)}>
                      Edit
                    </button>
                    <button className="btn small danger" onClick={() => onDeleteQuestion(q.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
