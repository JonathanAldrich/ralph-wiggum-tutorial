"""Views (routes) package.

Blueprint registration for all application routes.
Each view module defines a Blueprint with its routes.
"""
from flask import Flask


def register_blueprints(app: Flask) -> None:
    """Register all blueprints with the Flask application.

    Args:
        app: Flask application instance
    """
    from .hello import hello_bp
    from .pacman import pacman_bp

    app.register_blueprint(hello_bp)
    app.register_blueprint(pacman_bp, url_prefix='/pacman')
