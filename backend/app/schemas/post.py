from datetime import datetime

from pydantic import BaseModel


class PostPlatformStatus(BaseModel):
    id: str
    platform: str
    platform_username: str
    status: str
    error_message: str | None = None
    published_at: datetime | None = None


class PostCreate(BaseModel):
    caption: str
    hashtags: list[str] | None = None
    post_type: str = "feed"
    media_ids: list[str] | None = None
    account_ids: list[str]  # which social accounts to post to
    platform_captions: dict[str, str] | None = None  # account_id -> custom caption
    schedule_time: datetime | None = None  # if set, schedule instead of publish now
    publish_now: bool = False


class PostUpdate(BaseModel):
    caption: str | None = None
    hashtags: list[str] | None = None
    post_type: str | None = None
    media_ids: list[str] | None = None


class PostResponse(BaseModel):
    id: str
    caption: str
    hashtags: list[str] | None = None
    status: str
    post_type: str
    ai_generated: bool
    created_at: datetime
    updated_at: datetime
    platforms: list[PostPlatformStatus] = []

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    items: list[PostResponse]
    total: int
