import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ContentCategory(Base):
    """Category for organizing posts (e.g., Educational, Promotional, Behind-the-scenes)."""
    __tablename__ = "content_categories"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6", nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recyclable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recycle_interval_days: Mapped[int] = mapped_column(Integer, default=30)
    post_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", backref="content_categories")
    post_categories = relationship(
        "PostCategory", back_populates="category", cascade="all, delete"
    )
    recycle_queue_items = relationship(
        "RecycleQueue", back_populates="category", cascade="all, delete"
    )


class PostCategory(Base):
    """Junction table linking posts to categories."""
    __tablename__ = "post_categories"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    post_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("content_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )

    post = relationship("Post", backref="post_categories")
    category = relationship("ContentCategory", back_populates="post_categories")


class RecycleQueue(Base):
    """Queue of posts scheduled for recycling."""
    __tablename__ = "recycle_queue"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    post_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("content_categories.id", ondelete="CASCADE"), nullable=False
    )
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    times_recycled: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    post = relationship("Post", backref="recycle_queue_items")
    user = relationship("User", backref="recycle_queue_items")
    category = relationship("ContentCategory", back_populates="recycle_queue_items")
