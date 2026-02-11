from datetime import datetime

from pydantic import BaseModel, Field


class FeedGridItem(BaseModel):
    """A single item in the Instagram feed grid preview."""

    post_id: str
    thumbnail_url: str | None = None
    caption_preview: str = ""
    status: str  # published, scheduled, draft
    scheduled_time: datetime | None = None
    grid_position: int = Field(ge=0, description="Zero-based position in the grid")
    row: int = Field(ge=0, description="Zero-based row index in the 3-column grid")
    col: int = Field(ge=0, description="Zero-based column index (0, 1, or 2)")

    model_config = {"from_attributes": True}


class FeedGridResponse(BaseModel):
    """Response containing the full Instagram feed grid preview."""

    account_id: str
    platform: str = "instagram"
    items: list[FeedGridItem]
    total_published: int
    total_scheduled: int


class ReorderRequest(BaseModel):
    """Request to reorder scheduled posts in the feed grid."""

    post_ids: list[str] = Field(
        ...,
        min_length=1,
        description="Ordered list of scheduled post IDs in the desired display order",
    )


class ReorderResponse(BaseModel):
    """Response after reordering scheduled posts."""

    success: bool
    message: str
