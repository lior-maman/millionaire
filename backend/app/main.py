"""
FastAPI application: the HTTP surface React will call.

Endpoints
---------
GET  /                         health/info

Auth (open):
POST /api/auth/login           { email, password } -> { token, user }
GET  /api/auth/me              the signed-in user (requires a token)

Play (any signed-in user):
GET  /api/activities           list activities (for the menu / dropdown)
POST /api/games                { activity_id } -> a generated 15-question game
POST /api/answers              { game_id, question_id, selected_index } -> result
POST /api/lifelines/fifty-fifty { game_id, question_id } -> { hidden: [i, j] }
POST /api/lifelines/audience    { game_id, question_id } -> { percentages: [..] }
POST /api/games/{id}/finish     end the game, save the score -> result
DELETE /api/games/{game_id}    forget an abandoned game
GET  /api/leaderboard          player ranking (?activity_id= optional)

Admin (role == "admin"):
GET    /api/activities/{id}                     full activity + per-level counts
POST   /api/activities                          create an activity
DELETE /api/activities/{id}                     delete an activity
POST   /api/activities/{id}/questions           add a question
PUT    /api/activities/{id}/questions/{qid}     edit a question
DELETE /api/activities/{id}/questions/{qid}     delete a question
GET    /api/users                               list users
POST   /api/users                               create a user
PATCH  /api/users/{id}                          edit a user
DELETE /api/users/{id}                          delete a user

Auth is a signed Bearer token (see auth.py). The correct answer is never
included in play-side question payloads; it is only revealed through
POST /api/answers, one question at a time.
"""

from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from . import game_service, results_repo, users_repo
from .auth import (
    clear_login_fails,
    issue_token,
    login_blocked,
    login_rate_key,
    record_login_fail,
    require_admin,
    require_user,
    verify_password,
)
from .config import settings
from .database import close_mongo_connection, connect_to_mongo
from .models import (
    ActivityDetail,
    ActivityInput,
    ActivitySummary,
    AnswerRequest,
    AnswerResponse,
    AudienceResponse,
    FiftyFiftyResponse,
    Game,
    LifelineRequest,
    QuestionInDB,
    QuestionInput,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if len(settings.session_secret) < 16:
        raise RuntimeError("SESSION_SECRET is missing or too short (min 16 chars).")
    await connect_to_mongo()
    await users_repo.ensure_indexes()
    await results_repo.ensure_indexes()
    if settings.seed_on_startup:
        from .seed import seed_if_empty

        await seed_if_empty()
    # First-admin bootstrap (only while there is no admin at all).
    if (
        settings.bootstrap_admin_email
        and settings.bootstrap_admin_password
        and not await users_repo.admin_exists()
    ):
        try:
            await users_repo.create_user(
                settings.bootstrap_admin_email,
                settings.bootstrap_admin_password,
                name="Admin",
                role="admin",
            )
        except ValueError:
            # Email exists as a player — promote it instead.
            doc = await users_repo.find_by_email(settings.bootstrap_admin_email)
            await users_repo.update_user(str(doc["_id"]), {"role": "admin", "active": True})
    yield
    await close_mongo_connection()


app = FastAPI(title="Millionaire API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "app": "Millionaire API",
        "questions_per_level": settings.questions_per_level,
        "difficulties": list(settings.difficulties),
    }


# --- Auth ------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request):
    key = login_rate_key(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        req.email,
    )
    if login_blocked(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
    doc = await users_repo.find_by_email(req.email)
    ok = bool(doc) and verify_password(req.password, doc.get("password", ""))
    if not ok:
        record_login_fail(key)
        raise HTTPException(status_code=401, detail="Wrong email or password")
    if doc.get("active") is not True:
        raise HTTPException(status_code=403, detail="This account is disabled")
    clear_login_fails(key)
    await users_repo.touch_login(doc["_id"])
    return {"token": issue_token(str(doc["_id"])), "user": users_repo.public(doc)}


@app.get("/api/auth/me")
async def me(user: dict = Depends(require_user)):
    return user


# --- Play (signed-in users) ------------------------------------------------


@app.get(
    "/api/activities",
    response_model=list[ActivitySummary],
    dependencies=[Depends(require_user)],
)
async def get_activities():
    return await game_service.list_activities()


@app.post("/api/games", response_model=Game)
async def create_game(body: dict, user: dict = Depends(require_user)):
    activity_id = body.get("activity_id")
    if not activity_id:
        raise HTTPException(status_code=422, detail="activity_id is required")
    try:
        return await game_service.generate_game(activity_id, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/answers", response_model=AnswerResponse)
async def submit_answer(req: AnswerRequest, user: dict = Depends(require_user)):
    try:
        correct, correct_index = game_service.check_answer(
            req.game_id, req.question_id, req.selected_index, user["id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AnswerResponse(correct=correct, correct_index=correct_index)


@app.post("/api/lifelines/fifty-fifty", response_model=FiftyFiftyResponse)
async def lifeline_fifty_fifty(req: LifelineRequest, user: dict = Depends(require_user)):
    try:
        hidden = game_service.fifty_fifty(req.game_id, req.question_id, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return FiftyFiftyResponse(hidden=hidden)


@app.post("/api/lifelines/audience", response_model=AudienceResponse)
async def lifeline_audience(req: LifelineRequest, user: dict = Depends(require_user)):
    try:
        pct = game_service.ask_audience(req.game_id, req.question_id, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AudienceResponse(percentages=pct)


@app.post("/api/games/{game_id}/finish")
async def finish_game(game_id: str, user: dict = Depends(require_user)):
    """End the game and save the server-counted score to the leaderboard."""
    try:
        result = game_service.finish_game(game_id, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return await results_repo.save_result(user["id"], result)


@app.delete("/api/games/{game_id}")
async def delete_game(game_id: str, user: dict = Depends(require_user)):
    game_service.forget_game(game_id, user["id"])
    return {"ok": True}


@app.get("/api/leaderboard", dependencies=[Depends(require_user)])
async def get_leaderboard(activity_id: str | None = None):
    """Player ranking — overall, or for one activity with ?activity_id=..."""
    return await results_repo.leaderboard(activity_id or None)


# --- Admin endpoints (question bank management) ---------------------------


@app.get(
    "/api/activities/{activity_id}",
    response_model=ActivityDetail,
    dependencies=[Depends(require_admin)],
)
async def read_activity(activity_id: str):
    try:
        return await game_service.get_activity(activity_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post(
    "/api/activities",
    response_model=ActivitySummary,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
async def add_activity(payload: ActivityInput):
    return await game_service.create_activity(payload)


@app.delete("/api/activities/{activity_id}", dependencies=[Depends(require_admin)])
async def remove_activity(activity_id: str):
    try:
        await game_service.delete_activity(activity_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


@app.post(
    "/api/activities/{activity_id}/questions",
    response_model=QuestionInDB,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
async def add_question(activity_id: str, payload: QuestionInput):
    try:
        return await game_service.add_question(activity_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put(
    "/api/activities/{activity_id}/questions/{question_id}",
    response_model=QuestionInDB,
    dependencies=[Depends(require_admin)],
)
async def edit_question(activity_id: str, question_id: str, payload: QuestionInput):
    try:
        return await game_service.update_question(activity_id, question_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete(
    "/api/activities/{activity_id}/questions/{question_id}",
    dependencies=[Depends(require_admin)],
)
async def remove_question(activity_id: str, question_id: str):
    try:
        await game_service.delete_question(activity_id, question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


# --- Admin endpoints (user management) ------------------------------------

Role = Literal["player", "admin"]


def _check_email(v: str) -> str:
    v = (v or "").strip()
    if "@" not in v or "." not in v.split("@")[-1] or " " in v:
        raise ValueError("invalid email address")
    return v


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str = ""
    role: Role = "player"
    active: bool = True

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        return _check_email(v)


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = Field(default=None, min_length=8)
    name: str | None = None
    role: Role | None = None
    active: bool | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        return None if v is None else _check_email(v)


@app.get("/api/users", dependencies=[Depends(require_admin)])
async def admin_list_users() -> list[dict[str, Any]]:
    return await users_repo.list_users()


@app.post("/api/users", status_code=201, dependencies=[Depends(require_admin)])
async def admin_create_user(req: UserCreate) -> dict[str, Any]:
    try:
        return await users_repo.create_user(**req.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.patch("/api/users/{user_id}")
async def admin_update_user(
    user_id: str, req: UserUpdate, admin: dict = Depends(require_admin)
) -> dict[str, Any]:
    data = req.model_dump(exclude_none=True)
    # Never let an admin lock themselves out.
    if user_id == admin["id"] and (data.get("role") == "player" or data.get("active") is False):
        raise HTTPException(status_code=400, detail="You can't remove your own admin access")
    try:
        user = await users_repo.update_user(user_id, data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.delete("/api/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You can't delete your own account")
    if not await users_repo.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}
