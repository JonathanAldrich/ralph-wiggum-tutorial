"""Pac-Man views (routes).

Serves the dedicated Pac-Man game page. Gameplay is entirely client-side
(a React island backed by a canvas-driven engine), so this blueprint only
renders a single HTML page and exposes no API endpoints or persistence.

This page is purely additive: it is a richer showcase of the React Islands
architecture than the Hello demo and must not affect the Hello page at '/'.
"""
from flask import Blueprint, render_template

pacman_bp = Blueprint('pacman', __name__)


@pacman_bp.route('/')
def index():  # type: ignore[no-untyped-def]
    """Render the Pac-Man page with its React island mount point.

    Serves HTML containing a [data-island="pacman"] element that the
    frontend hydrates with the interactive game. No props are needed
    because the game state is created and owned entirely on the client.
    """
    return render_template('pacman/index.html')
