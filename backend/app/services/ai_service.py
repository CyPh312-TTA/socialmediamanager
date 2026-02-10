import json

import anthropic

from app.core.config import settings
from app.schemas.ai import (
    CalendarResponse,
    CalendarSlot,
    CaptionRequest,
    CaptionResponse,
    HashtagRequest,
    HashtagResponse,
    RewriteRequest,
    RewriteResponse,
    CalendarRequest,
)


def _get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


PLATFORM_LIMITS = {
    "twitter": 280,
    "instagram": 2200,
    "facebook": 63206,
    "tiktok": 2200,
}


async def generate_caption(request: CaptionRequest) -> CaptionResponse:
    client = _get_client()
    platforms_info = "\n".join(
        f"- {p}: max {PLATFORM_LIMITS.get(p, 2000)} characters"
        for p in request.platforms
    )

    message = client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=settings.AI_MAX_TOKENS,
        system="""You are an expert social media copywriter. Generate engaging captions
tailored for each platform. Respect character limits. Return ONLY valid JSON.""",
        messages=[
            {
                "role": "user",
                "content": f"""Generate social media captions for the following:

Description: {request.description}
Tone: {request.tone}
Keywords: {', '.join(request.keywords) if request.keywords else 'none specified'}

Target platforms and their limits:
{platforms_info}

Return JSON in this exact format:
{{
    "captions": {{"platform_name": "caption text"}},
    "variations": [{{"platform_name": "alternative caption"}}]
}}

Generate the main caption and 2 alternative variations for each platform.""",
            }
        ],
    )

    try:
        result = json.loads(message.content[0].text)
        return CaptionResponse(
            captions=result.get("captions", {}),
            variations=result.get("variations"),
        )
    except (json.JSONDecodeError, IndexError):
        return CaptionResponse(
            captions={p: message.content[0].text for p in request.platforms}
        )


async def generate_hashtags(request: HashtagRequest) -> HashtagResponse:
    client = _get_client()

    message = client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=1024,
        system="""You are a social media hashtag strategist. Generate relevant,
trending hashtags. Return ONLY valid JSON.""",
        messages=[
            {
                "role": "user",
                "content": f"""Generate hashtags for this {request.platform} post:

Caption: {request.caption}
Category: {request.category or 'general'}

Return JSON:
{{
    "hashtags": ["tag1", "tag2", ...],
    "broad": ["popular broad tags"],
    "niche": ["specific niche tags"]
}}

Generate 20-30 hashtags total. Do NOT include the # symbol.""",
            }
        ],
    )

    try:
        result = json.loads(message.content[0].text)
        return HashtagResponse(
            hashtags=result.get("hashtags", []),
            broad=result.get("broad", []),
            niche=result.get("niche", []),
        )
    except (json.JSONDecodeError, IndexError):
        return HashtagResponse(hashtags=[], broad=[], niche=[])


async def rewrite_for_platform(request: RewriteRequest) -> RewriteResponse:
    client = _get_client()

    source_limit = PLATFORM_LIMITS.get(request.source_platform, 2000)
    target_limit = PLATFORM_LIMITS.get(request.target_platform, 2000)

    message = client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=1024,
        system="""You are a social media copywriter who adapts content across platforms.
Preserve the core message but adjust tone, length, and style for each platform.""",
        messages=[
            {
                "role": "user",
                "content": f"""Rewrite this {request.source_platform} post for {request.target_platform}.

Original ({request.source_platform}, max {source_limit} chars):
{request.caption}

Target: {request.target_platform} (max {target_limit} chars)

Rules:
- Twitter: concise, punchy, conversational
- Instagram: storytelling, emojis welcome, longer format
- Facebook: informative, can be longest, includes call-to-action
- TikTok: trendy, casual, uses popular phrases

Return ONLY the rewritten caption text, nothing else.""",
            }
        ],
    )

    return RewriteResponse(rewritten_caption=message.content[0].text.strip())


async def generate_calendar(request: CalendarRequest) -> CalendarResponse:
    client = _get_client()

    message = client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=settings.AI_MAX_TOKENS,
        system="""You are a social media content strategist. Create content calendars
with engaging post ideas. Return ONLY valid JSON.""",
        messages=[
            {
                "role": "user",
                "content": f"""Create a content calendar from {request.start_date} to {request.end_date}.

Platforms: {', '.join(request.platforms)}
Posts per day: {request.posts_per_day}
Content themes: {', '.join(request.content_themes) if request.content_themes else 'varied'}

Return JSON:
{{
    "slots": [
        {{
            "date": "YYYY-MM-DD",
            "time": "HH:MM",
            "platform": "platform_name",
            "content_type": "feed/reel/story/carousel",
            "theme": "theme description",
            "suggested_caption": "full caption text"
        }}
    ]
}}

Suggest optimal posting times. Vary content types and themes.""",
            }
        ],
    )

    try:
        result = json.loads(message.content[0].text)
        slots = [CalendarSlot(**slot) for slot in result.get("slots", [])]
        return CalendarResponse(slots=slots)
    except (json.JSONDecodeError, IndexError):
        return CalendarResponse(slots=[])
