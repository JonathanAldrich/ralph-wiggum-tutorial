"""Pydantic schemas for the Snake leaderboard API.

Validates score submissions and serializes leaderboard responses.

The score upper bound exists to gracefully reject spoofed submissions:
a 20x20 board has 400 cells and the snake starts at length 3, so the most
food a player can ever eat in one run is 397. Anything higher is rejected.
"""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator

# Board geometry — must stay in sync with frontend game.ts.
BOARD_SIZE = 20
INITIAL_SNAKE_LENGTH = 3
MAX_SCORE = BOARD_SIZE * BOARD_SIZE - INITIAL_SNAKE_LENGTH  # 397


class ScoreCreate(BaseModel):
    """Schema for submitting a completed Snake run.

    Validates incoming request data for POST /api/snake/scores.
    """
    player_name: str = Field(
        ..., min_length=1, max_length=20,
        description="Player initials or short display name",
    )
    score: int = Field(
        ..., ge=1, le=MAX_SCORE,
        description="Number of food items eaten (1..MAX_SCORE)",
    )

    @field_validator('player_name')
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Trim surrounding whitespace and reject blank names."""
        stripped = value.strip()
        if not stripped:
            raise ValueError('player_name must not be blank')
        return stripped


class ScoreResponse(BaseModel):
    """Schema for serializing a leaderboard entry in API responses."""
    id: int
    player_name: str
    score: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
