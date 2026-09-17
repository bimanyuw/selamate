"""Preserve Admin/Driver authorization with persistent accounts."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("role", sa.String(16), nullable=False, server_default="Driver"))


def downgrade():
    op.drop_column("users", "role")
