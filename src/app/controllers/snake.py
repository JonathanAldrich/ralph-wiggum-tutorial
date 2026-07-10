"""Snake leaderboard controller.

Encapsulates persistence for leaderboard entries. Views call these methods
rather than touching models directly, keeping the MVC layering intact.
"""
from sqlalchemy import select
from ..models import SnakeScore, db
from ..schemas import ScoreCreate

DEFAULT_LIMIT = 10


class SnakeController:
    """Controller for Snake leaderboard operations."""

    @staticmethod
    def get_top(limit: int = DEFAULT_LIMIT) -> list[SnakeScore]:
        """Return the highest scores in deterministic order.

        Ordering: highest score first; ties broken by earliest ``created_at``
        (the player who reached the score first ranks higher), then by ``id``
        for a fully stable order. This tie-breaker is asserted in the tests.

        Args:
            limit: Maximum number of entries to return.

        Returns:
            List of SnakeScore instances, best first.
        """
        stmt = (
            select(SnakeScore)
            .order_by(
                SnakeScore.score.desc(),
                SnakeScore.created_at.asc(),
                SnakeScore.id.asc(),
            )
            .limit(limit)
        )
        return list(db.session.execute(stmt).scalars())

    @staticmethod
    def create(data: ScoreCreate) -> SnakeScore:
        """Persist a new leaderboard entry.

        Args:
            data: Validated ScoreCreate payload.

        Returns:
            The newly created SnakeScore instance.
        """
        score = SnakeScore(player_name=data.player_name, score=data.score)
        db.session.add(score)
        db.session.commit()
        return score
