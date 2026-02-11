from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# BioLink schemas
# ---------------------------------------------------------------------------

class BioLinkCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1)
    icon: str | None = Field(None, max_length=50)
    thumbnail_url: str | None = None


class BioLinkUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    url: str | None = Field(None, min_length=1)
    icon: str | None = None
    thumbnail_url: str | None = None
    is_active: bool | None = None


class BioLinkResponse(BaseModel):
    id: str
    bio_page_id: str
    title: str
    url: str
    icon: str | None = None
    thumbnail_url: str | None = None
    position: int
    is_active: bool
    click_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# BioPage schemas
# ---------------------------------------------------------------------------

class BioPageCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str = Field(..., min_length=1, max_length=255)
    bio: str | None = None
    avatar_url: str | None = None
    theme: str = Field("default", max_length=50)
    bg_color: str = Field("#ffffff", max_length=20)
    text_color: str = Field("#000000", max_length=20)
    button_style: str = Field("rounded", max_length=20)


class BioPageUpdate(BaseModel):
    slug: str | None = Field(None, min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str | None = Field(None, min_length=1, max_length=255)
    bio: str | None = None
    avatar_url: str | None = None
    theme: str | None = Field(None, max_length=50)
    bg_color: str | None = Field(None, max_length=20)
    text_color: str | None = Field(None, max_length=20)
    button_style: str | None = Field(None, max_length=20)
    is_published: bool | None = None


class BioPageResponse(BaseModel):
    id: str
    user_id: str
    slug: str
    title: str
    bio: str | None = None
    avatar_url: str | None = None
    theme: str
    bg_color: str
    text_color: str
    button_style: str
    is_published: bool
    total_views: int
    created_at: datetime
    updated_at: datetime
    links: list[BioLinkResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Public view (no analytics fields exposed)
# ---------------------------------------------------------------------------

class PublicBioLinkResponse(BaseModel):
    id: str
    title: str
    url: str
    icon: str | None = None
    thumbnail_url: str | None = None
    position: int
    is_active: bool

    model_config = {"from_attributes": True}


class PublicBioPageResponse(BaseModel):
    id: str
    slug: str
    title: str
    bio: str | None = None
    avatar_url: str | None = None
    theme: str
    bg_color: str
    text_color: str
    button_style: str
    links: list[PublicBioLinkResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Reorder & Analytics
# ---------------------------------------------------------------------------

class ReorderLinksRequest(BaseModel):
    link_ids: list[str]


class ClicksByDay(BaseModel):
    date: str
    count: int


class ClickAnalyticsResponse(BaseModel):
    link_id: str
    link_title: str
    total_clicks: int
    clicks_by_day: list[ClicksByDay] = []
