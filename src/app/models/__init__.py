"""Database models package.

Exports all models for easy importing throughout the application.
"""
from .base import db
from .snake_score import SnakeScore

__all__ = ['db', 'SnakeScore']
