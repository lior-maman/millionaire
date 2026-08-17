import { useEffect, useState } from "react";
import { listActivities } from "../api.js";

/**
 * Start screen: loads the activities and lets the player pick one from a
 * dropdown before starting. The dropdown is always shown; when there is only
 * one activity it is preselected, but the control still makes the choice explicit.
 */
export default function StartScreen({ onStart }) {
  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listActivities()
      .then((data) => {
        setActivities(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const chosen = activities.find((a) => a.id === selectedId);

  return (
    <div className="panel start-panel">
      <h2 className="panel-title">Choose an activity</h2>

      {loading && <p className="muted">Loading activities…</p>}
      {error && <p className="error">Failed to load activities: {error}</p>}

      {!loading && !error && activities.length === 0 && (
        <p className="muted">
          No activities yet. Go to "Manage questions" to create one, or run the seed script.
        </p>
      )}

      {!loading && activities.length > 0 && (
        <>
          <label className="field">
            <span className="field-label">Activity</span>
            <select
              className="select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.question_count} questions)
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn btn-primary btn-lg"
            disabled={!chosen}
            onClick={() => onStart({ id: chosen.id, name: chosen.name })}
          >
            Start game
          </button>

          <p className="muted small">
            Each game has 15 questions — 5 per difficulty level, drawn at random every time.
          </p>
        </>
      )}
    </div>
  );
}
