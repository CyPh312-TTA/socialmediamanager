import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EngagementByTime(Base):
    """Tracks engagement metrics bucketed by hour and day of week."""

    __tablename__ = "engagement_by_time"
    __table_args__ = (
        UniqueConstraint(
            "social_account_id", "day_of_week", "hour_utc", name="uq_account_day_hour"
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    social_account_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("social_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    day_of_week: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 0=Mon, 6=Sun
    hour_utc: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 0-23
    avg_engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_impressions: Mapped[float] = mapped_column(Float, default=0.0)
    avg_reach: Mapped[float] = mapped_column(Float, default=0.0)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
