"""SnakeScore model for the Snake arcade leaderboard.

Persists completed Snake runs so scores survive across sessions and can
be displayed on a shared leaderboard. The active game loop lives entirely
on the client; the backend only stores and serves finished results.
"""
from datetime import datetime
from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class SnakeScore(Base):
    """A single leaderboard entry for a completed Snake run.

    Attributes:
        id: Primary key
        player_name: Player initials or short display name (max 20 chars)
        score: Number of food items eaten during the run (>= 1)
        created_at: Timestamp when the score was recorded
    """
    __tablename__ = 'snake_scores'

    id: Mapped[int] = mapped_column(primary_key=True)
    player_name: Mapped[str] = mapped_column(String(20), nullable=False)
    score: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    def __repr__(self) -> str:
        return f'<SnakeScore {self.id}: {self.player_name}={self.score}>'
