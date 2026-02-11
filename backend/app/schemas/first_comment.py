from datetime import datetime

from pydantic import BaseModel, Field


class FirstCommentCreate(BaseModel):
    post_platform_id: str
    comment_text: str = Field(min_length=1, max_length=2200)
    delay_seconds: int = Field(default=5, ge=0, le=3600)


class FirstCommentResponse(BaseModel):
    id: str
    post_platform_id: str
    comment_text: str
    delay_seconds: int
    status: str
    platform_comment_id: str | None = None
    error_message: str | None = None
    posted_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
