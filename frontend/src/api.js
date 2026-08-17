/**
 * Thin API client for the Millionaire backend.
 * Uses a relative /api base by default (Vite proxies it to FastAPI in dev).
 * Override with VITE_API_BASE for a deployed backend on another origin.
 */
const BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  // DELETE endpoints may return {ok:true}; all are JSON.
  return res.json();
}

// Header carrying the admin secret for question-bank management endpoints.
const adminHeaders = (secret) => ({ "X-Admin-Secret": secret });

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

// --- Admin (all require the admin secret) -------------------------------
export const getActivity = (id, secret) =>
  request(`/api/activities/${id}`, { headers: adminHeaders(secret) });

export const createActivity = (name, questions = [], secret) =>
  request("/api/activities", {
    method: "POST",
    headers: adminHeaders(secret),
    body: JSON.stringify({ name, questions }),
  });

export const deleteActivity = (id, secret) =>
  request(`/api/activities/${id}`, {
    method: "DELETE",
    headers: adminHeaders(secret),
  });

export const addQuestion = (activityId, question, secret) =>
  request(`/api/activities/${activityId}/questions`, {
    method: "POST",
    headers: adminHeaders(secret),
    body: JSON.stringify(question),
  });

export const updateQuestion = (activityId, questionId, question, secret) =>
  request(`/api/activities/${activityId}/questions/${questionId}`, {
    method: "PUT",
    headers: adminHeaders(secret),
    body: JSON.stringify(question),
  });

export const deleteQuestion = (activityId, questionId, secret) =>
  request(`/api/activities/${activityId}/questions/${questionId}`, {
    method: "DELETE",
    headers: adminHeaders(secret),
  });
