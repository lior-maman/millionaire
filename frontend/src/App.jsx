import { useEffect, useState } from "react";
import StartScreen from "./screens/StartScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import AdminScreen from "./screens/AdminScreen.jsx";

/**
 * Top-level screen router. Three views:
 *   start  -> pick an activity (dropdown) and begin
 *   game   -> play a generated 15-question game
 *   admin  -> manage the question bank
 * Kept as simple local state; no router dependency needed for three screens.
 *
 * Theme (light default / dark) is applied via data-theme on <html> and
 * persisted in localStorage.
 */
export default function App() {
  const [screen, setScreen] = useState("start");
  const [activity, setActivity] = useState(null); // { id, name } chosen to play
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="brand">Who Wants to Be a Millionaire</h1>
        </div>
        <nav className="nav">
          <button
            className={screen === "start" ? "nav-btn active" : "nav-btn"}
            onClick={() => setScreen("start")}
          >
            Play
          </button>
          <button
            className={screen === "admin" ? "nav-btn active" : "nav-btn"}
            onClick={() => setScreen("admin")}
          >
            Manage questions
          </button>
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
        </nav>
      </header>

      <main className="content">
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
            onExit={() => setScreen("start")}
          />
        )}
        {screen === "admin" && <AdminScreen />}
      </main>
    </div>
  );
}
