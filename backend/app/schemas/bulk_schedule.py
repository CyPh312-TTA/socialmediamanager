from datetime import datetime

from pydantic import BaseModel, Field


class BulkEntryData(BaseModel):
    """A single validated entry from the CSV, ready for post creation."""

    caption: str
    hashtags: list[str] | None = None
    platforms: list[str]
    schedule_time: str  # ISO-format string
    post_type: str = "feed"
    media_urls: list[str] | None = None


class BulkPreviewEntry(BaseModel):
    row_number: int
    caption: str = Field(description="First 50 characters of the caption")
    platforms: list[str]
    schedule_time: str
    is_valid: bool
    error: str | None = None


class BulkPreviewResponse(BaseModel):
    total_rows: int
    valid_count: int
    error_count: int
    entries: list[BulkPreviewEntry]


class BulkConfirmRequest(BaseModel):
    entries: list[BulkEntryData]


class BulkResultResponse(BaseModel):
    created: int
    failed: int
    errors: list[str]
