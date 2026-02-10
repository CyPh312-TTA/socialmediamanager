from datetime import datetime

from pydantic import BaseModel


class MediaAssetResponse(BaseModel):
    id: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    media_type: str
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    thumbnail_path: str | None = None
    alt_text: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaListResponse(BaseModel):
    items: list[MediaAssetResponse]
    total: int
