"""Create alerts table."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "alerts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("region", sa.String(128), nullable=False),
        sa.Column("hazard", sa.String(128), nullable=False),
        sa.Column("level", sa.String(32), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("is_simulation", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade():
    op.drop_table("alerts")
