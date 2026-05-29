"""Tests for the Pac-Man page route.

The Pac-Man feature is purely additive and client-side: these tests assert the
page renders, exposes its React island mount point and server-rendered control
copy, and — critically — that adding the page did not regress the Hello page
at '/'. There is intentionally no API/persistence coverage because the game
state lives entirely in the browser.
"""
from __future__ import annotations

from typing import Any

from flask.testing import FlaskClient


class TestPacmanPage:
    """Tests for the Pac-Man HTML page at /pacman."""

    def test_pacman_returns_html(self, client: FlaskClient[Any]) -> None:
        """GET /pacman should return a 200 HTML page with the Pac-Man heading."""
        response = client.get('/pacman/')
        assert response.status_code == 200
        assert b'Pac-Man' in response.data

    def test_pacman_redirects_without_trailing_slash(self, client: FlaskClient[Any]) -> None:
        """GET /pacman should resolve to the page (Flask redirects to /pacman/)."""
        response = client.get('/pacman', follow_redirects=True)
        assert response.status_code == 200
        assert b'Pac-Man' in response.data

    def test_pacman_contains_island_mount(self, client: FlaskClient[Any]) -> None:
        """The page should contain the React island mount point."""
        response = client.get('/pacman/')
        assert b'data-island="pacman"' in response.data

    def test_pacman_shows_control_instructions(self, client: FlaskClient[Any]) -> None:
        """Server-rendered control instructions should be present for no-JS users."""
        response = client.get('/pacman/')
        assert b'Controls' in response.data
        assert b'Pause' in response.data


class TestNoHelloRegression:
    """Adding Pac-Man must not break the existing Hello page."""

    def test_hello_index_still_works(self, client: FlaskClient[Any]) -> None:
        """GET / should still render the Hello page unchanged."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Hello World' in response.data
        assert b'data-island="hello"' in response.data

    def test_nav_links_present(self, client: FlaskClient[Any]) -> None:
        """Both pages should expose navigation links for discoverability."""
        response = client.get('/')
        assert b'href="/pacman"' in response.data
        assert b'href="/"' in response.data
