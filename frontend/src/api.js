/**
 * Thin API client for the Millionaire backend.
 * Uses a relative /api base by default (Vite proxies it to FastAPI in dev).
 * Override with VITE_API_BASE for a deployed backend on another origin.
 *
 * Auth: after login the token is kept in localStorage and sent as
 * "Authorization: Bearer <token>" on every call. A 401 clears it and fires an
 * "auth:expired" window event so App drops back to the login screen.
 */
const BASE = import.meta.env.VITE_API_BASE || "";
const TOKEN_KEY = "millionaire.token";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};
const setToken = (t) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage blocked */ }
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...rest,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) {
        // FastAPI validation errors come back as a list.
        detail = Array.isArray(body.detail)
          ? body.detail.map((d) => d.msg).join("; ")
          : body.detail;
      }
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401 && path !== "/api/auth/login") {
      clearToken();
      window.dispatchEvent(new Event("auth:expired"));
    }
    throw new Error(detail);
  }
  // DELETE endpoints may return {ok:true}; all are JSON.
  return res.json();
}

// --- Auth ---------------------------------------------------------------

export async function login(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export const me = () => request("/api/auth/me");

export const logout = () => clearToken();

// --- Play ---------------------------------------------------------------

export const listActivities = () => request("/api/activities");

export const createGame = (activityId) =>
  request("/api/games", {
    method: "POST",
    body: JSON.stringify({ activity_id: activityId }),
  });

export const submitAnswer = (gameId, questionId, selectedIndex) =>
  request("/api/answers", {
    method: "POST",
    body: JSON.stringify({
      game_id: gameId,
      question_id: questionId,
      selected_index: selectedIndex,
    }),
  });

export const forgetGame = (gameId) =>
  request(`/api/games/${gameId}`, { method: "DELETE" });

// End the game: the server saves ITS OWN count of correct answers.
export const finishGame = (gameId) =>
  request(`/api/games/${gameId}/finish`, { method: "POST" });

// Player ranking — overall, or for one activity.
export const getLeaderboard = (activityId) =>
  request(
    activityId
      ? `/api/leaderboard?activity_id=${encodeURIComponent(activityId)}`
      : "/api/leaderboard"
  );

// --- Lifelines ----------------------------------------------------------

export const fiftyFifty = (gameId, questionId) =>
  request("/api/lifelines/fifty-fifty", {
    method: "POST",
    body: JSON.stringify({ game_id: gameId, question_id: questionId }),
  });

export const askAudience = (gameId, questionId) =>
  request("/api/lifelines/audience", {
    method: "POST",
    body: JSON.stringify({ game_id: gameId, question_id: questionId }),
  });

// --- Admin: question bank (admin role) -----------------------------------

export const getActivity = (id) => request(`/api/activities/${id}`);

export const createActivity = (name, questions = []) =>
  request("/api/activities", {
    method: "POST",
    body: JSON.stringify({ name, questions }),
  });

export const deleteActivity = (id) =>
  request(`/api/activities/${id}`, { method: "DELETE" });

export const addQuestion = (activityId, question) =>
  request(`/api/activities/${activityId}/questions`, {
    method: "POST",
    body: JSON.stringify(question),
  });

export const updateQuestion = (activityId, questionId, question) =>
  request(`/api/activities/${activityId}/questions/${questionId}`, {
    method: "PUT",
    body: JSON.stringify(question),
  });

export const deleteQuestion = (activityId, questionId) =>
  request(`/api/activities/${activityId}/questions/${questionId}`, {
    method: "DELETE",
  });

// --- Admin: users (admin role) -------------------------------------------

export const listUsers = () => request("/api/users");

export const createUser = (user) =>
  request("/api/users", { method: "POST", body: JSON.stringify(user) });

export const updateUser = (id, changes) =>
  request(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteUser = (id) =>
  request(`/api/users/${id}`, { method: "DELETE" });
