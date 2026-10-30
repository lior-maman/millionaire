import { useEffect, useState } from "react";
import StartScreen from "./screens/StartScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import AdminScreen from "./screens/AdminScreen.jsx";
import UsersScreen from "./screens/UsersScreen.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import LeaderboardScreen from "./screens/LeaderboardScreen.jsx";
import { getToken, logout, me } from "./api.js";
import "./auth.css";

/**
 * Top-level screen router. Everyone signs in first, then:
 *   start  -> pick an activity (dropdown) and begin
 *   game   -> play a generated 15-question game (score saved at the end)
 *   leaderboard -> compare players' results
 *   admin  -> manage the question bank   (admins only)
 *   users  -> manage user accounts       (admins only)
 * Kept as simple local state; no router dependency needed for a few screens.
 * The admin-only buttons are hidden for players, but the server is what
 * actually enforces the role.
 *
 * Theme (light default / dark) is applied via data-theme on <html> and
 * persisted in localStorage.
 */
export default function App() {
  const [screen, setScreen] = useState("start");
  const [activity, setActivity] = useState(null); // { id, name } chosen to play
  const [user, setUser] = useState(null);          // the signed-in user
  const [checking, setChecking] = useState(() => !!getToken());
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Resume a saved session, and fall back to login whenever the server
  // rejects the token (expired, user disabled or deleted).
  useEffect(() => {
    if (getToken()) {
      me()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setChecking(false));
    }
    const onExpired = () => {
      setUser(null);
      setScreen("start");
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  const signOut = () => {
    logout();
    setUser(null);
    setScreen("start");
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="brand">Who Wants to Be a Millionaire</h1>
        </div>
        <nav className="nav">
          {user && (
            <button
              className={screen === "start" ? "nav-btn active" : "nav-btn"}
              onClick={() => setScreen("start")}
            >
              Play
            </button>
          )}
          {user && (
            <button
              className={screen === "leaderboard" ? "nav-btn active" : "nav-btn"}
              onClick={() => setScreen("leaderboard")}
            >
              Leaderboard
            </button>
          )}
          {isAdmin && (
            <button
              className={screen === "admin" ? "nav-btn active" : "nav-btn"}
              onClick={() => setScreen("admin")}
            >
              Manage questions
            </button>
          )}
          {isAdmin && (
            <button
              className={screen === "users" ? "nav-btn active" : "nav-btn"}
              onClick={() => setScreen("users")}
            >
              Users
            </button>
          )}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title="Toggle light / dark theme"
            aria-label="Toggle light or dark theme"
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
          {screen === "game" && (
            <button
              className="exit-btn"
              onClick={() => setScreen("start")}
              title="Close the current game"
            >
              Close game
            </button>
          )}
          {user && (
            <span className="user-chip">
              <span dir="auto">{user.name || user.email}</span>
              <button className="exit-btn" onClick={signOut} title="Sign out">
                Sign out
              </button>
            </span>
          )}
        </nav>
      </header>

      <main className="content">
        {checking && <p className="muted">Loading…</p>}
        {!checking && !user && <LoginScreen onLogin={setUser} />}
        {!checking && user && (
          <>
            {screen === "start" && (
              <StartScreen
                onStart={(chosen) => {
                  setActivity(chosen);
                  setScreen("game");
                }}
              />
            )}
            {screen === "game" && activity && (
              <GameScreen
                activity={activity}
                currentUser={user}
                onExit={() => setScreen("start")}
              />
            )}
            {screen === "leaderboard" && <LeaderboardScreen currentUser={user} />}
            {screen === "admin" && isAdmin && <AdminScreen />}
            {screen === "users" && isAdmin && <UsersScreen currentUser={user} />}
          </>
        )}
      </main>
    </div>
  );
}
