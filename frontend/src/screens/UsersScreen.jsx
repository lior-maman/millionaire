import { useEffect, useState } from "react";
import { listUsers, createUser, updateUser, deleteUser } from "../api.js";

const EMPTY_USER = { email: "", name: "", password: "", role: "player", active: true };

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "never");

/**
 * Users screen (admins only — the server enforces it too).
 *   - list every account with role, status and last sign-in
 *   - add a user / edit name, email, role, active, password / delete
 *
 * Password on edit is optional: leave it blank to keep the current one.
 * You can't demote, disable or delete your own account (prevents lockout).
 */
export default function UsersScreen({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState(EMPTY_USER);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);

  const refresh = () => listUsers().then(setUsers);

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

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

  const resetForm = () => {
    setDraft(EMPTY_USER);
    setEditingId(null);
  };

  const onSubmit = guard(async (e) => {
    e.preventDefault();
    if (!draft.email.trim()) {
      setError("Email is required.");
      return;
    }
    if (editingId) {
      const changes = { ...draft };
      if (!changes.password) delete changes.password; // keep current password
      await updateUser(editingId, changes);
    } else {
      if (draft.password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      await createUser(draft);
    }
    resetForm();
    await refresh();
  });

  const onEdit = (u) => {
    setEditingId(u.id);
    setDraft({ email: u.email, name: u.name, password: "", role: u.role, active: u.active });
  };

  const onDelete = guard(async (u) => {
    if (!confirm(`Delete the user "${u.name || u.email}"?`)) return;
    await deleteUser(u.id);
    if (editingId === u.id) resetForm();
    await refresh();
  });

  const isSelf = editingId === currentUser.id;

  return (
    <div className="admin">
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h3 className="panel-title">{editingId ? "Edit user" : "Add user"}</h3>
        <form className="user-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              dir="ltr"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="input"
              dir="auto"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">
              {editingId ? "New password (leave blank to keep)" : "Password (min 8)"}
            </span>
            <input
              className="input"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select
              className="select"
              value={draft.role}
              disabled={isSelf}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            >
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.active}
              disabled={isSelf}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            <span>Active (can sign in)</span>
          </label>
          <div className="row">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Save changes" : "Add user"}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <h3 className="panel-title">Users ({users.length})</h3>
        <ul className="q-list">
          {users.map((u) => (
            <li key={u.id} className="q-item">
              <div className="q-item-main">
                <span className={`level-chip small ${u.role === "admin" ? "medium" : "easy"}`}>
                  {u.role === "admin" ? "Admin" : "Player"}
                </span>
                {!u.active && <span className="level-chip small low">Disabled</span>}
                <span className="q-text">
                  <strong dir="auto">{u.name || "—"}</strong>{" "}
                  <span className="muted" dir="ltr">{u.email}</span>
                  <span className="muted small"> · last sign-in: {fmtDate(u.lastLoginAt)}</span>
                </span>
              </div>
              <div className="q-item-actions">
                <button className="btn small" onClick={() => onEdit(u)}>
                  Edit
                </button>
                <button
                  className="btn small danger"
                  disabled={u.id === currentUser.id}
                  title={u.id === currentUser.id ? "You can't delete yourself" : ""}
                  onClick={() => onDelete(u)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
