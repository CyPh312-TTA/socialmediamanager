import json
import logging

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.analytics import AIUsageLog
from app.schemas.strategy import (
    ContentPillar,
    PerformanceAnalysisResponse,
    PostIdea,
    PostIdeasResponse,
    StrategyResponse,
    WeeklySlot,
)

logger = logging.getLogger(__name__)

STRATEGY_SYSTEM_PROMPT = """\
You are an elite social media strategist and content marketing expert with 15+ years \
of experience growing brands on every major platform. You combine data-driven insights \
with creative storytelling to craft strategies that drive engagement and conversions.

Your expertise includes:
- Platform-specific best practices for Instagram, Twitter/X, Facebook, TikTok, LinkedIn, \
Pinterest, and YouTube
- Content pillar frameworks and editorial calendars
- Audience segmentation and persona-based messaging
- Hashtag research and SEO for social platforms
- Growth hacking tactics and community building
- Analytics interpretation and performance optimization

When generating strategies:
1. Tailor every recommendation to the specific business type and audience.
2. Provide actionable, concrete advice rather than generic platitudes.
3. Include platform-specific nuances (character limits, algorithm preferences, optimal \
formats).
4. Balance promotional content with value-driven and community-building content.
5. Suggest realistic posting schedules aligned with the requested frequency.

CRITICAL: You MUST return ONLY valid JSON. No markdown, no code fences, no commentary \
outside the JSON object. The response must be parseable by json.loads() directly.\
"""

POST_IDEAS_SYSTEM_PROMPT = """\
You are an expert social media content creator. Generate creative, engaging post ideas \
that align with the given strategy context. Each idea should be ready to use or easily \
adaptable. Include platform-appropriate formatting, hashtags, and content types.

CRITICAL: You MUST return ONLY valid JSON. No markdown, no code fences, no commentary \
outside the JSON object.\
"""

PERFORMANCE_ANALYSIS_SYSTEM_PROMPT = """\
You are a social media analytics expert. Analyze the provided post performance data to \
extract meaningful insights and actionable recommendations. Focus on identifying patterns \
in what works vs. what doesn't, and provide specific, data-backed suggestions for improvement.

CRITICAL: You MUST return ONLY valid JSON. No markdown, no code fences, no commentary \
outside the JSON object.\
"""


def _get_async_client() -> AsyncAnthropic:
    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def _strip_json_fences(text: str) -> str:
    """Remove markdown code fences that LLMs sometimes add despite instructions."""
    stripped = text.strip()
    if stripped.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = stripped.index("\n")
        stripped = stripped[first_newline + 1 :]
    if stripped.endswith("```"):
        stripped = stripped[: -3]
    return stripped.strip()


async def _log_ai_usage(
    db: AsyncSession,
    user_id: str,
    action_type: str,
    input_tokens: int,
    output_tokens: int,
    model: str,
) -> None:
    log_entry = AIUsageLog(
        user_id=user_id,
        action_type=action_type,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        model=model,
    )
    db.add(log_entry)
    await db.flush()


async def generate_content_strategy(
    answers: dict,
    user_id: str,
    db: AsyncSession,
) -> dict:
    """Generate a comprehensive content strategy from questionnaire answers.

    Args:
        answers: Questionnaire data containing business_type, target_audience,
                 goals, platforms, tone, posting_frequency, and optional content_pillars.
        user_id: ID of the requesting user.
        db: Async database session.

    Returns:
        Structured dict matching StrategyResponse schema.
    """
    client = _get_async_client()

    pillars_instruction = ""
    if answers.get("content_pillars"):
        pillars_instruction = (
            f"The user has suggested these content pillars: "
            f"{', '.join(answers['content_pillars'])}. "
            f"Refine and build upon them, adding descriptions and percentage splits."
        )
    else:
        pillars_instruction = (
            "Suggest 3-5 content pillars appropriate for this business. "
            "Each pillar should have a clear theme and purpose."
        )

    user_prompt = f"""\
Generate a comprehensive social media content strategy based on the following profile:

Business Type: {answers['business_type']}
Target Audience: {answers['target_audience']}
Marketing Goals: {', '.join(answers['goals'])}
Platforms: {', '.join(answers['platforms'])}
Brand Tone/Voice: {answers['tone']}
Desired Posting Frequency: {answers['posting_frequency']}

{pillars_instruction}

Return a JSON object with EXACTLY this structure:
{{
    "pillars": [
        {{
            "name": "Pillar Name",
            "description": "What this pillar covers and why it matters",
            "percentage": 30,
            "sample_topics": ["Topic 1", "Topic 2", "Topic 3"]
        }}
    ],
    "weekly_schedule": [
        {{
            "day_of_week": "Monday",
            "time": "09:00",
            "pillar": "Pillar Name",
            "post_type": "carousel/reel/story/text/image/video/thread"
        }}
    ],
    "post_ideas": [
        {{
            "pillar": "Pillar Name",
            "title": "Post Idea Title",
            "description": "Brief description of the post concept",
            "platform": "instagram",
            "post_type": "carousel"
        }}
    ],
    "hashtag_strategy": {{
        "platform_name": ["hashtag1", "hashtag2", "hashtag3"]
    }},
    "growth_tactics": [
        "Specific actionable tactic for growth"
    ]
}}

Requirements:
- Pillar percentages must sum to 100.
- Weekly schedule should match the requested posting frequency of \
"{answers['posting_frequency']}".
- Provide 3-5 post ideas per pillar.
- Hashtag strategy must include entries for each platform: \
{', '.join(answers['platforms'])}.
- Provide at least 5 growth tactics specific to the selected platforms.
- All times should be in HH:MM 24-hour format.
- Do NOT include the # symbol in hashtags.\
"""

    model = settings.AI_MODEL
    message = await client.messages.create(
        model=model,
        max_tokens=settings.AI_MAX_TOKENS,
        system=STRATEGY_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    await _log_ai_usage(
        db=db,
        user_id=user_id,
        action_type="strategy_generate",
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
        model=model,
    )

    raw_text = message.content[0].text
    cleaned = _strip_json_fences(raw_text)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse strategy JSON from Claude: %s", raw_text[:500])
        raise ValueError(
            "The AI returned an invalid response. Please try again."
        )

    # Validate and structure the response through Pydantic models
    try:
        pillars = [ContentPillar(**p) for p in result.get("pillars", [])]
        weekly_schedule = [WeeklySlot(**s) for s in result.get("weekly_schedule", [])]
    except Exception as exc:
        logger.error("Failed to validate strategy structure: %s", exc)
        raise ValueError(
            "The AI response had an unexpected structure. Please try again."
        )

    return StrategyResponse(
        pillars=pillars,
        weekly_schedule=weekly_schedule,
        post_ideas=result.get("post_ideas", []),
        hashtag_strategy=result.get("hashtag_strategy", {}),
        growth_tactics=result.get("growth_tactics", []),
    ).model_dump()


async def generate_post_ideas(
    strategy_context: str,
    count: int,
    platform: str,
    user_id: str,
    db: AsyncSession,
) -> list[dict]:
    """Generate specific post ideas based on an existing strategy.

    Args:
        strategy_context: Summary of the current content strategy.
        count: Number of post ideas to generate.
        platform: Target platform for the ideas.
        user_id: ID of the requesting user.
        db: Async database session.

    Returns:
        List of dicts, each containing caption, hashtags, post_type, and platform.
    """
    client = _get_async_client()

    user_prompt = f"""\
Based on the following content strategy context, generate {count} unique post ideas \
for {platform}.

Strategy Context:
{strategy_context}

Return a JSON object with EXACTLY this structure:
{{
    "ideas": [
        {{
            "caption": "Full ready-to-post caption text",
            "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
            "post_type": "carousel/reel/story/text/image/video/thread",
            "platform": "{platform}"
        }}
    ]
}}

Requirements:
- Each caption should be platform-appropriate in length and style.
- Include 5-15 relevant hashtags per post (no # symbol).
- Vary post types to keep the feed dynamic.
- Captions should be engaging, on-brand, and include a call to action where appropriate.
- For Twitter/X, keep captions under 280 characters.
- For Instagram, include line breaks and emojis where natural.
- For TikTok, use trending language and hooks.\
"""

    model = settings.AI_MODEL
    message = await client.messages.create(
        model=model,
        max_tokens=settings.AI_MAX_TOKENS,
        system=POST_IDEAS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    await _log_ai_usage(
        db=db,
        user_id=user_id,
        action_type="strategy_post_ideas",
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
        model=model,
    )

    raw_text = message.content[0].text
    cleaned = _strip_json_fences(raw_text)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse post ideas JSON from Claude: %s", raw_text[:500])
        raise ValueError(
            "The AI returned an invalid response. Please try again."
        )

    ideas = []
    for item in result.get("ideas", []):
        try:
            idea = PostIdea(**item)
            ideas.append(idea.model_dump())
        except Exception:
            # Skip malformed entries but keep valid ones
            logger.warning("Skipping malformed post idea: %s", item)
            continue

    return ideas


async def analyze_content_performance(
    post_data: list[dict],
    user_id: str,
    db: AsyncSession,
) -> dict:
    """Analyze past post performance and suggest improvements.

    Args:
        post_data: List of dicts with post content and metrics
                   (likes, comments, shares, impressions, etc.).
        user_id: ID of the requesting user.
        db: Async database session.

    Returns:
        Dict matching PerformanceAnalysisResponse with insights,
        recommendations, and top_performing_types.
    """
    client = _get_async_client()

    # Truncate post data to avoid exceeding token limits while keeping enough context
    serialized_data = json.dumps(post_data[:50], default=str)

    user_prompt = f"""\
Analyze the following social media post performance data and provide actionable insights.

Post Performance Data (each entry contains post content/type and engagement metrics):
{serialized_data}

Return a JSON object with EXACTLY this structure:
{{
    "insights": [
        "Insight about patterns in the data (e.g., 'Carousel posts generate 3x more \
saves than single images')"
    ],
    "recommendations": [
        "Specific actionable recommendation to improve performance"
    ],
    "top_performing_types": [
        "content type or category that performs best"
    ]
}}

Requirements:
- Provide 5-10 data-driven insights based on the actual numbers.
- Provide 5-8 specific, actionable recommendations.
- Identify 3-5 top-performing content types or themes.
- Reference actual metrics and patterns you observe.
- Be specific rather than generic (e.g., "Post at 6 PM on Thursdays" instead of \
"Post at optimal times").
- If the data is limited, note that and still provide best-effort analysis.\
"""

    model = settings.AI_MODEL
    message = await client.messages.create(
        model=model,
        max_tokens=settings.AI_MAX_TOKENS,
        system=PERFORMANCE_ANALYSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    await _log_ai_usage(
        db=db,
        user_id=user_id,
        action_type="strategy_analyze",
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
        model=model,
    )

    raw_text = message.content[0].text
    cleaned = _strip_json_fences(raw_text)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse analysis JSON from Claude: %s", raw_text[:500])
        raise ValueError(
            "The AI returned an invalid response. Please try again."
        )

    try:
        response = PerformanceAnalysisResponse(**result)
    except Exception as exc:
        logger.error("Failed to validate analysis structure: %s", exc)
        raise ValueError(
            "The AI response had an unexpected structure. Please try again."
        )

    return response.model_dump()
