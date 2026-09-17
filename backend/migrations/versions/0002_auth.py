"""Add users and revocable authentication sessions."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("name", sa.String(120), nullable=False),
                    sa.Column("email", sa.String(254), nullable=False, unique=True),
                    sa.Column("password_hash", sa.Text(), nullable=False))
    op.create_table("auth_sessions", sa.Column("token_hash", sa.String(64), primary_key=True),
                    sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
                    sa.Column("expires_at", sa.BigInteger(), nullable=False))
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])


def downgrade():
    op.drop_table("auth_sessions")
    op.drop_table("users")
