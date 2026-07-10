"""Pydantic schemas package.

Exports all request/response schemas for API validation.
"""
from .snake import ScoreCreate, ScoreResponse

__all__ = ['ScoreCreate', 'ScoreResponse']
