import { useEffect, useState } from "react";
import { getLeaderboard, listActivities } from "../api.js";
import { PRIZES, formatPrize } from "../prizes.js";

const prizeFor = (correct) => (correct > 0 ? formatPrize(PRIZES[correct - 1]) : "—");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * Leaderboard: compares players by their BEST finished game, then by average,
 * then by games played. Can be filtered to one activity (or "All activities").
 * The signed-in player's row is highlighted.
 *
 * Used both as its own screen (nav "Leaderboard") and under the end-of-game
 * panel, where it starts filtered to the activity just played.
 */
export default function LeaderboardScreen({ currentUser, initialActivityId = "", compact = false }) {
  const [activities, setActivities] = useState([]);
  const [activityId, setActivityId] = useState(initialActivityId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listActivities().then(setActivities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getLeaderboard(activityId)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activityId]);

  return (
    <section className="panel">
      <div className="row wrap lb-head">
        <h2 className="panel-title">Leaderboard</h2>
        <select
          className="select"
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
        >
          <option value="">All activities</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="muted">No finished games yet. Be the first!</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="lb-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Best</th>
                <th>Best prize</th>
                <th>Average</th>
                <th>Games</th>
                {!compact && <th>Last played</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.user_id} className={r.user_id === currentUser?.id ? "lb-me" : ""}>
                  <td className="lb-rank">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                  <td dir="auto">{r.name}</td>
                  <td>{r.best}/{r.total}</td>
                  <td>{prizeFor(r.best)}</td>
                  <td>{r.avg}</td>
                  <td>{r.games}</td>
                  {!compact && <td>{fmtDate(r.last)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
