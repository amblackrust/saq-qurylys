"""Track completion of mandatory ad analysis separately from optional LLM extraction.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-20 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ad_post", sa.Column("analysis_status", sa.String(length=7), nullable=True))
    op.create_check_constraint(
        op.f("ck_ad_post_analysis_status"),
        "ad_post",
        "analysis_status IN ('pending', 'done', 'failed')",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_ad_post_analysis_status"), "ad_post", type_="check")
    op.drop_column("ad_post", "analysis_status")
