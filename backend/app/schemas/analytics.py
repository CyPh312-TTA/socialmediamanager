from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class AnalyticsOverview(BaseModel):
    total_posts: int = 0
    total_published: int = 0
    total_impressions: int = 0
    total_reach: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    avg_engagement_rate: float = 0.0
    total_followers: int = 0


class PlatformBreakdown(BaseModel):
    platform: str
    platform_username: str
    account_id: str
    posts_count: int = 0
    impressions: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    followers: int = 0
    engagement_rate: float = 0.0


class PostPerformance(BaseModel):
    post_id: str
    caption: str
    platform: str
    published_at: Optional[datetime] = None
    impressions: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    engagement_rate: float = 0.0


class DailyMetric(BaseModel):
    date: str
    impressions: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    engagement_rate: float = 0.0


class AnalyticsDashboard(BaseModel):
    overview: AnalyticsOverview
    platform_breakdown: list[PlatformBreakdown]
    top_posts: list[PostPerformance]
    daily_metrics: list[DailyMetric]


class SnapshotResponse(BaseModel):
    id: str
    social_account_id: str
    metric_type: str
    impressions: int
    reach: int
    likes: int
    comments: int
    shares: int
    saves: int
    clicks: int
    followers_count: int
    engagement_rate: float
    snapshot_date: date
    created_at: datetime

    model_config = {"from_attributes": True}
