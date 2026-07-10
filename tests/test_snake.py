"""Tests for Snake routes and the leaderboard API.

Covers the server-rendered page (Snake branding + island mount point) and the
JSON leaderboard contract: empty state, creation, validation failures, and the
deterministic ordering/tie-breaker documented in SnakeController.get_top.
"""
import json
from typing import Any


class TestSnakePage:
    """Tests for the main HTML page."""

    def test_index_returns_html(self, client: Any) -> None:
        """GET / should return the Snake page."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Snake' in response.data

    def test_index_contains_island_mount(self, client: Any) -> None:
        """Index page should contain the snake React island mount point."""
        response = client.get('/')
        assert b'data-island="snake"' in response.data


class TestSnakeAPI:
    """Tests for the Snake leaderboard JSON API."""

    def test_list_empty(self, client: Any) -> None:
        """GET /api/snake/scores should return an empty list initially."""
        response = client.get('/api/snake/scores')
        assert response.status_code == 200
        assert json.loads(response.data) == []

    def test_create_score(self, client: Any) -> None:
        """POST /api/snake/scores should create a leaderboard entry."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': 'ABC', 'score': 42},
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['player_name'] == 'ABC'
        assert data['score'] == 42
        assert 'id' in data
        assert 'created_at' in data

    def test_create_trims_name(self, client: Any) -> None:
        """Player names should be trimmed of surrounding whitespace."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': '  ZZ  ', 'score': 5},
        )
        assert response.status_code == 201
        assert json.loads(response.data)['player_name'] == 'ZZ'

    def test_list_after_create(self, client: Any) -> None:
        """GET should return created entries."""
        client.post('/api/snake/scores', json={'player_name': 'ONE', 'score': 10})
        response = client.get('/api/snake/scores')
        data = json.loads(response.data)
        assert len(data) == 1
        assert data[0]['player_name'] == 'ONE'

    def test_reject_blank_name(self, client: Any) -> None:
        """Blank/whitespace-only names are rejected."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': '   ', 'score': 5},
        )
        assert response.status_code == 400

    def test_reject_overlong_name(self, client: Any) -> None:
        """Names longer than 20 chars are rejected."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': 'X' * 21, 'score': 5},
        )
        assert response.status_code == 400

    def test_reject_zero_score(self, client: Any) -> None:
        """Zero score is rejected (only completed scoring runs are stored)."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': 'ABC', 'score': 0},
        )
        assert response.status_code == 400

    def test_reject_negative_score(self, client: Any) -> None:
        """Negative scores are rejected."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': 'ABC', 'score': -3},
        )
        assert response.status_code == 400

    def test_reject_out_of_range_score(self, client: Any) -> None:
        """Scores above the board-derived maximum are rejected (anti-spoofing)."""
        response = client.post(
            '/api/snake/scores',
            json={'player_name': 'ABC', 'score': 100000},
        )
        assert response.status_code == 400

    def test_reject_malformed_payload(self, client: Any) -> None:
        """Non-object / missing fields are rejected with 400."""
        response = client.post(
            '/api/snake/scores',
            data='not json',
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_reject_missing_fields(self, client: Any) -> None:
        """Missing required fields are rejected."""
        response = client.post('/api/snake/scores', json={'score': 5})
        assert response.status_code == 400

    def test_leaderboard_ordering_and_tiebreak(self, client: Any) -> None:
        """Highest score first; ties broken by earliest created_at (insertion)."""
        # Two entries tie at 50; 'FIRST' is inserted first so it must rank higher.
        client.post('/api/snake/scores', json={'player_name': 'LOW', 'score': 10})
        client.post('/api/snake/scores', json={'player_name': 'FIRST', 'score': 50})
        client.post('/api/snake/scores', json={'player_name': 'SECOND', 'score': 50})
        client.post('/api/snake/scores', json={'player_name': 'TOP', 'score': 90})

        data = json.loads(client.get('/api/snake/scores').data)
        assert [e['player_name'] for e in data] == ['TOP', 'FIRST', 'SECOND', 'LOW']

    def test_leaderboard_limit(self, client: Any) -> None:
        """Only the top 10 entries are returned."""
        for i in range(1, 15):
            client.post('/api/snake/scores', json={'player_name': f'P{i}', 'score': i})
        data = json.loads(client.get('/api/snake/scores').data)
        assert len(data) == 10
        # Highest score first
        assert data[0]['score'] == 14
        assert data[-1]['score'] == 5


class TestErrorHandlers:
    """Tests for error handling."""

    def test_404_html(self, client: Any) -> None:
        """404 should return HTML for browser requests."""
        response = client.get('/nonexistent')
        assert response.status_code == 404
        assert b'Page Not Found' in response.data or b'404' in response.data

    def test_404_json(self, client: Any) -> None:
        """404 should return JSON for API requests."""
        response = client.get(
            '/nonexistent',
            headers={'Accept': 'application/json'},
        )
        assert response.status_code == 404
        assert 'error' in json.loads(response.data)
