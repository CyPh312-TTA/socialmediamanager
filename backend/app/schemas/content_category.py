from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Category schemas
# ---------------------------------------------------------------------------


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#3b82f6", max_length=20)
    icon: str | None = Field(default=None, max_length=50)
    description: str | None = None
    is_recyclable: bool = False
    recycle_interval_days: int = Field(default=30, ge=1)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = None
    description: str | None = None
    is_recyclable: bool | None = None
    recycle_interval_days: int | None = Field(default=None, ge=1)


class CategoryResponse(BaseModel):
    id: str
    user_id: str
    name: str
    color: str
    icon: str | None = None
    description: str | None = None
    is_recyclable: bool
    recycle_interval_days: int
    post_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryListResponse(BaseModel):
    items: list[CategoryResponse]


# ---------------------------------------------------------------------------
# Post-category assignment schemas
# ---------------------------------------------------------------------------


class PostCategoryAssign(BaseModel):
    post_id: str
    category_id: str


# ---------------------------------------------------------------------------
# Recycle queue schemas
# ---------------------------------------------------------------------------


class RecycleQueueAdd(BaseModel):
    post_id: str
    category_id: str
    scheduled_for: datetime


class RecycleQueueItemResponse(BaseModel):
    id: str
    post_id: str
    post_title: str
    category_id: str
    category_name: str
    scheduled_for: datetime
    status: str
    times_recycled: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RecycleQueueResponse(BaseModel):
    items: list[RecycleQueueItemResponse]


# ---------------------------------------------------------------------------
# Recyclable posts listing
# ---------------------------------------------------------------------------


class RecyclablePostItem(BaseModel):
    post_id: str
    caption: str
    category_id: str
    category_name: str
    last_published_at: datetime | None = None
    recycle_interval_days: int

    model_config = {"from_attributes": True}


class RecyclablePostsResponse(BaseModel):
    items: list[RecyclablePostItem]
