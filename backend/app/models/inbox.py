import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InboxMessage(Base):
    """Unified inbox message from any platform."""
    __tablename__ = "inbox_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    social_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # comment, dm, mention, reply
    platform_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    platform_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender_id: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_username: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_replied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)  # positive, negative, neutral
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
