"""
Pydantic models (schemas) for the Millionaire game.

Data shape in MongoDB — one document per activity:

    {
        "_id": ObjectId(...),
        "name": "General Knowledge",
        "questions": [
            {
                "id": "q1",
                "text": "...",
                "options": ["...", "...", "...", "..."],   # exactly 4
                "correct_index": 2,                          # 0..3, ONE correct
                "difficulty": "easy"                         # easy | medium | hard
            },
            ... 30 total, 10 per difficulty
        ]
    }

The API never sends `correct_index` to the client. Answer checking happens
server-side via a dedicated endpoint.
"""
from typing import Literal
from pydantic import BaseModel, Field, field_validator

Difficulty = Literal["easy", "medium", "hard"]


class QuestionInDB(BaseModel):
    """A question exactly as stored in Mongo (includes the correct answer)."""
    id: str
    text: str
    options: list[str]
    correct_index: int = Field(ge=0, le=3)
    difficulty: Difficulty

    @field_validator("options")
    @classmethod
    def must_have_four_options(cls, v: list[str]) -> list[str]:
        if len(v) != 4:
            raise ValueError("each question must have exactly 4 options")
        return v


class ActivityInDB(BaseModel):
    """An activity document: a named bank of 30 questions."""
    name: str
    questions: list[QuestionInDB]


class PublicQuestion(BaseModel):
    """A question as sent to the client — WITHOUT the correct answer."""
    id: str
    text: str
    options: list[str]
    difficulty: Difficulty


class GameQuestion(PublicQuestion):
    """A question inside a generated game, carrying its display order."""
    order: int


class Game(BaseModel):
    """A generated game: 15 questions (5 per difficulty), answer hidden."""
    game_id: str
    activity_id: str
    activity_name: str
    questions: list[GameQuestion]
    total: int


class AnswerRequest(BaseModel):
    """Client submits an answer for one question in a game."""
    game_id: str
    question_id: str
    selected_index: int = Field(ge=0, le=3)


class AnswerResponse(BaseModel):
    """Server tells the client whether it was right (and the correct index)."""
    correct: bool
    correct_index: int


class LifelineRequest(BaseModel):
    """Client invokes a lifeline for a specific question in a game."""
    game_id: str
    question_id: str


class FiftyFiftyResponse(BaseModel):
    """Indices of two wrong options to hide."""
    hidden: list[int]


class AudienceResponse(BaseModel):
    """Audience vote percentages per option (index 0..3), summing to 100."""
    percentages: list[int]


class ActivitySummary(BaseModel):
    """Lightweight activity listing for menu screens."""
    id: str
    name: str
    question_count: int


# --- Admin / CRUD models --------------------------------------------------

class QuestionInput(BaseModel):
    """Payload for creating or updating a question. `id` is assigned server-side."""
    text: str
    options: list[str]
    correct_index: int = Field(ge=0, le=3)
    difficulty: Difficulty

    @field_validator("options")
    @classmethod
    def must_have_four_options(cls, v: list[str]) -> list[str]:
        if len(v) != 4:
            raise ValueError("each question must have exactly 4 options")
        return v


class ActivityInput(BaseModel):
    """Payload for creating a new activity. Questions optional (can start empty)."""
    name: str
    questions: list[QuestionInput] = []


class LevelCount(BaseModel):
    """Per-difficulty question count, so the admin UI can flag understocked levels."""
    difficulty: Difficulty
    count: int
    playable: bool  # count >= questions_per_level


class ActivityDetail(BaseModel):
    """Full activity view for the admin editor, including per-level counts."""
    id: str
    name: str
    questions: list[QuestionInDB]
    level_counts: list[LevelCount]

