"""Snake views (routes).

Serves the server-rendered Snake page (with a React island mount point and
initial leaderboard data) plus the JSON leaderboard API. The game loop is
entirely client-side; these endpoints only read and persist scores.
"""
from flask import Blueprint, render_template, jsonify, request
from pydantic import ValidationError
from ..controllers import SnakeController
from ..schemas import ScoreCreate, ScoreResponse

snake_bp = Blueprint('snake', __name__)


@snake_bp.route('/')
def index():  # type: ignore[no-untyped-def]
    """Render the Snake page with a [data-island="snake"] mount point.

    Passes the current top leaderboard entries as initial props so the
    island renders without an extra round-trip and the page is useful
    even before hydration.
    """
    scores = SnakeController.get_top()
    scores_data = [ScoreResponse.model_validate(s).model_dump(mode='json') for s in scores]
    return render_template('snake/index.html', scores=scores_data)


@snake_bp.route('/api/snake/scores', methods=['GET'])
def api_list():  # type: ignore[no-untyped-def]
    """Return the top leaderboard entries as a JSON array."""
    scores = SnakeController.get_top()
    return jsonify([ScoreResponse.model_validate(s).model_dump(mode='json') for s in scores])


@snake_bp.route('/api/snake/scores', methods=['POST'])
def api_create():  # type: ignore[no-untyped-def]
    """Create a new leaderboard entry from a completed run.

    Request body:
        {"player_name": "ABC", "score": 42}

    Returns:
        201: Created leaderboard entry
        400: Validation error (blank/overlong name, out-of-range/invalid score,
             or malformed/non-JSON payload)
    """
    try:
        data = ScoreCreate.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        # include_context=False drops non-JSON-serializable objects (e.g. the
        # ValueError raised by custom validators) from the error details.
        details = e.errors(include_context=False, include_url=False)
        return jsonify(error="Validation Error", details=details), 400

    score = SnakeController.create(data)
    return jsonify(ScoreResponse.model_validate(score).model_dump(mode='json')), 201
