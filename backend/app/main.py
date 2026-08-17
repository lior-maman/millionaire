"""
FastAPI application: the HTTP surface React will call.

Endpoints
---------
GET  /                         health/info

Play:
GET  /api/activities           list activities (for the menu / dropdown)
POST /api/games                { activity_id } -> a generated 15-question game
POST /api/answers              { game_id, question_id, selected_index } -> result
POST /api/lifelines/fifty-fifty { game_id, question_id } -> { hidden: [i, j] }
POST /api/lifelines/audience    { game_id, question_id } -> { percentages: [..] }
DELETE /api/games/{game_id}    forget a finished game

Admin (question bank management):
GET    /api/activities/{id}                     full activity + per-level counts
POST   /api/activities                          create an activity
DELETE /api/activities/{id}                     delete an activity
POST   /api/activities/{id}/questions           add a question
PUT    /api/activities/{id}/questions/{qid}     edit a question
DELETE /api/activities/{id}/questions/{qid}     delete a question

The correct answer is never included in play-side question payloads; it is only
revealed through POST /api/answers, one question at a time.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import game_service
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
    await connect_to_mongo()
    if settings.seed_on_startup:
        from .seed import seed_if_empty

        await seed_if_empty()
    yield
    await close_mongo_connection()


app = FastAPI(title="Millionaire API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_admin(x_admin_secret: str = Header(default="")) -> None:
    """
    Guard for question-bank management (write) endpoints. The client must send
    the shared secret in the "X-Admin-Secret" header, matching ADMIN_SECRET from
    the environment. Read/play endpoints are intentionally left open.
    """
    if x_admin_secret != settings.admin_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing admin secret")


@app.get("/")
async def root():
    return {
        "app": "Millionaire API",
        "questions_per_level": settings.questions_per_level,
        "difficulties": list(settings.difficulties),
    }


@app.get("/api/activities", response_model=list[ActivitySummary])
async def get_activities():
    return await game_service.list_activities()


@app.post("/api/games", response_model=Game)
async def create_game(body: dict):
    activity_id = body.get("activity_id")
    if not activity_id:
        raise HTTPException(status_code=422, detail="activity_id is required")
    try:
        return await game_service.generate_game(activity_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/answers", response_model=AnswerResponse)
async def submit_answer(req: AnswerRequest):
    try:
        correct, correct_index = game_service.check_answer(
            req.game_id, req.question_id, req.selected_index
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AnswerResponse(correct=correct, correct_index=correct_index)


@app.post("/api/lifelines/fifty-fifty", response_model=FiftyFiftyResponse)
async def lifeline_fifty_fifty(req: LifelineRequest):
    try:
        hidden = game_service.fifty_fifty(req.game_id, req.question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return FiftyFiftyResponse(hidden=hidden)


@app.post("/api/lifelines/audience", response_model=AudienceResponse)
async def lifeline_audience(req: LifelineRequest):
    try:
        pct = game_service.ask_audience(req.game_id, req.question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AudienceResponse(percentages=pct)


@app.delete("/api/games/{game_id}")
async def delete_game(game_id: str):
    game_service.forget_game(game_id)
    return {"ok": True}


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
