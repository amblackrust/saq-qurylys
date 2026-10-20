"""Remember the territory to restore when unlinking an ad from an object.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-20 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ad_post", sa.Column("unlinked_territory_id", sa.BigInteger(), nullable=True))
    op.add_column(
        "ad_post", sa.Column("unlinked_territory_saved", sa.Boolean(), server_default=sa.false(), nullable=False)
    )
    op.create_foreign_key(
        op.f("fk_ad_post_unlinked_territory_id_territory"),
        "ad_post",
        "territory",
        ["unlinked_territory_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_ad_post_unlinked_territory_id_territory"), "ad_post", type_="foreignkey")
    op.drop_column("ad_post", "unlinked_territory_saved")
    op.drop_column("ad_post", "unlinked_territory_id")
