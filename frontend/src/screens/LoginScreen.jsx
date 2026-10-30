import { useState } from "react";
import { login } from "../api.js";

/**
 * Sign-in screen. Every player needs an account (created by an admin in the
 * "Users" screen). On success hands the user object up to App.
 */
export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setBusy(true);
    try {
      onLogin(await login(email.trim(), password));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel start-panel">
      <h2 className="panel-title">Sign in</h2>
      <p className="muted">Sign in to play.</p>
      <form className="login-form" onSubmit={submit}>
        <input
          className="input"
          type="email"
          dir="ltr"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <input
          className="input"
          type="password"
          dir="ltr"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="muted small">No account? Ask your admin to create one.</p>
    </div>
  );
}
