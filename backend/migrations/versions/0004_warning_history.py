"""Persist warning incidents and their response/escalation timeline."""
from alembic import op
import sqlalchemy as sa

revision = "0004_warning_history"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("warning_incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("driver_id", sa.String(36), nullable=False),
        sa.Column("driver_name", sa.String(120), nullable=False),
        sa.Column("cause", sa.String(24), nullable=False),
        sa.Column("initial_level", sa.Integer(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.Column("deadline", sa.Float()), sa.Column("responded_at", sa.Float()),
        sa.Column("response", sa.String(24)), sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()), sa.Column("risk_score", sa.Float()),
        sa.Column("rest_name", sa.String(120), nullable=False))
    for name in ("session_id", "state", "updated_at"):
        op.create_index(f"ix_warning_incidents_{name}", "warning_incidents", [name])
    op.create_table("warning_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_id", sa.String(36), sa.ForeignKey("warning_incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("message", sa.String(500), nullable=False))
    op.create_index("ix_warning_events_incident_id", "warning_events", ["incident_id"])


def downgrade():
    op.drop_table("warning_events")
    op.drop_table("warning_incidents")
