"""create snake_scores table and drop hello table

Replaces the Hello World demo domain with the Snake leaderboard. Creates the
``snake_scores`` table and drops the now-unused ``hello`` table. This is a
forward migration so the original hello migration history is preserved.

Revision ID: a1b2c3d4e5f6
Revises: e31396db40b1
Create Date: 2026-07-09 23:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e31396db40b1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'snake_scores',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_name', sa.String(length=20), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.drop_table('hello')


def downgrade():
    op.create_table(
        'hello',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.drop_table('snake_scores')
