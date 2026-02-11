from datetime import datetime

from pydantic import BaseModel


class InboxMessageResponse(BaseModel):
    id: str
    user_id: str
    social_account_id: str
    platform: str
    message_type: str
    platform_message_id: str
    platform_post_id: str | None = None
    sender_id: str
    sender_username: str
    sender_avatar_url: str | None = None
    content: str
    is_read: bool
    is_replied: bool
    sentiment: str | None = None
    received_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class InboxListResponse(BaseModel):
    items: list[InboxMessageResponse]
    total: int
    unread: int


class UnreadCountsResponse(BaseModel):
    by_platform: dict[str, int]
    by_type: dict[str, int]
    total: int


class ReplyRequest(BaseModel):
    reply_text: str


class MarkAllReadRequest(BaseModel):
    platform: str | None = None
