from pydantic import BaseModel


class CaptionRequest(BaseModel):
    description: str
    platforms: list[str]  # ['instagram', 'twitter', 'facebook', 'tiktok']
    tone: str = "professional"  # professional, casual, funny, inspirational
    keywords: list[str] | None = None


class CaptionResponse(BaseModel):
    captions: dict[str, str]  # platform -> caption
    variations: list[dict[str, str]] | None = None


class HashtagRequest(BaseModel):
    caption: str
    platform: str
    category: str | None = None


class HashtagResponse(BaseModel):
    hashtags: list[str]
    broad: list[str]
    niche: list[str]


class RewriteRequest(BaseModel):
    caption: str
    source_platform: str
    target_platform: str


class RewriteResponse(BaseModel):
    rewritten_caption: str


class CalendarRequest(BaseModel):
    start_date: str  # ISO date
    end_date: str  # ISO date
    platforms: list[str]
    content_themes: list[str] | None = None
    posts_per_day: int = 1


class CalendarSlot(BaseModel):
    date: str
    time: str
    platform: str
    content_type: str
    theme: str
    suggested_caption: str


class CalendarResponse(BaseModel):
    slots: list[CalendarSlot]
