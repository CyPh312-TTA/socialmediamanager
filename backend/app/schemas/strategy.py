from pydantic import BaseModel, Field


class StrategyQuestionnaire(BaseModel):
    business_type: str = Field(
        ..., description="Type of business (e.g., 'SaaS startup', 'e-commerce', 'restaurant')"
    )
    target_audience: str = Field(
        ..., description="Description of the target audience"
    )
    goals: list[str] = Field(
        ..., description="Marketing goals (e.g., 'brand awareness', 'lead generation')"
    )
    platforms: list[str] = Field(
        ..., description="Social media platforms to target (e.g., 'instagram', 'twitter')"
    )
    tone: str = Field(
        ..., description="Brand voice/tone (e.g., 'professional', 'casual', 'witty')"
    )
    posting_frequency: str = Field(
        ..., description="Desired posting frequency (e.g., 'daily', '3x per week')"
    )
    content_pillars: list[str] | None = Field(
        default=None,
        description="Optional predefined content pillars; AI will suggest if not provided",
    )


class ContentPillar(BaseModel):
    name: str
    description: str
    percentage: float = Field(
        ..., ge=0, le=100, description="Percentage of total content allocated to this pillar"
    )
    sample_topics: list[str]


class WeeklySlot(BaseModel):
    day_of_week: str
    time: str
    pillar: str
    post_type: str


class StrategyResponse(BaseModel):
    pillars: list[ContentPillar]
    weekly_schedule: list[WeeklySlot]
    post_ideas: list[dict]
    hashtag_strategy: dict[str, list[str]]
    growth_tactics: list[str]


class PostIdeasRequest(BaseModel):
    strategy_context: str = Field(
        ..., description="Summary of the current content strategy for context"
    )
    count: int = Field(default=5, ge=1, le=20)
    platform: str


class PostIdea(BaseModel):
    caption: str
    hashtags: list[str]
    post_type: str
    platform: str


class PostIdeasResponse(BaseModel):
    ideas: list[PostIdea]


class PerformanceAnalysisRequest(BaseModel):
    post_data: list[dict] = Field(
        ..., description="List of posts with simplified metrics (likes, comments, shares, etc.)"
    )


class PerformanceAnalysisResponse(BaseModel):
    insights: list[str]
    recommendations: list[str]
    top_performing_types: list[str]
