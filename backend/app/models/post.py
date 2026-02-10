import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hashtags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    status: Mapped[str] = mapped_column(
        String(20), default="draft", nullable=False, index=True
    )  # draft, scheduled, publishing, published, failed
    post_type: Mapped[str] = mapped_column(
        String(20), default="feed", nullable=False
    )  # feed, reel, story, carousel
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="posts")
    post_media = relationship("PostMedia", back_populates="post", cascade="all, delete")
    post_platforms = relationship("PostPlatform", back_populates="post", cascade="all, delete")
    scheduled_post = relationship(
        "ScheduledPost", back_populates="post", uselist=False, cascade="all, delete"
    )


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    post_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    media_asset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    post = relationship("Post", back_populates="post_media")
    media_asset = relationship("MediaAsset", back_populates="post_media")


class PostPlatform(Base):
    __tablename__ = "post_platforms"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    post_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    social_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False
    )
    platform_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform_media_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )  # pending, published, failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    platform_specific_caption: Mapped[str | None] = mapped_column(Text, nullable=True)

    post = relationship("Post", back_populates="post_platforms")
    social_account = relationship("SocialAccount", back_populates="post_platforms")


class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    post_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("posts.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    scheduled_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )  # pending, processing, completed, cancelled
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    post = relationship("Post", back_populates="scheduled_post")
