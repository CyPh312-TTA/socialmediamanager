"""Service for the Visual Feed Planner (Instagram grid preview).

Provides functions to retrieve, order, and reposition scheduled Instagram
posts so users can preview how their 3-column grid will look.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.media_asset import MediaAsset
from app.models.post import Post, PostMedia, PostPlatform, ScheduledPost
from app.models.social_account import SocialAccount

logger = logging.getLogger(__name__)

GRID_COLUMNS = 3


async def _validate_instagram_account(
    social_account_id: str,
    user_id: str,
    db: AsyncSession,
) -> SocialAccount:
    """Validate that the account exists, belongs to the user, and is Instagram.

    Returns the SocialAccount if valid; raises otherwise.
    """
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == social_account_id,
            SocialAccount.user_id == user_id,
            SocialAccount.is_active.is_(True),
        )
    )
    account = result.scalar_one_or_none()

    if account is None:
        raise NotFoundError("Social account not found or inactive")

    if account.platform != "instagram":
        raise BadRequestError(
            f"Feed planner is only available for Instagram accounts. "
            f"This account is for '{account.platform}'."
        )

    return account


async def get_feed_preview(
    social_account_id: str,
    user_id: str,
    db: AsyncSession,
    limit: int = 18,
) -> dict:
    """Return an ordered list of posts for the Instagram feed grid preview.

    The grid combines the most recent published posts and all pending
    scheduled posts, each annotated with its thumbnail, caption preview,
    status, and calculated grid position.

    Returns a dict with keys: account_id, items, total_published,
    total_scheduled.
    """
    account = await _validate_instagram_account(social_account_id, user_id, db)

    # ---- Fetch published posts (most recent first) ----
    published_query = (
        select(Post)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            PostPlatform.social_account_id == social_account_id,
            PostPlatform.status == "published",
            Post.user_id == user_id,
        )
        .options(
            selectinload(Post.post_media).selectinload(PostMedia.media_asset),
        )
        .order_by(PostPlatform.published_at.desc())
    )

    # Count total published posts for this account
    count_published_query = (
        select(func.count())
        .select_from(Post)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            PostPlatform.social_account_id == social_account_id,
            PostPlatform.status == "published",
            Post.user_id == user_id,
        )
    )

    # ---- Fetch scheduled posts (soonest first) ----
    scheduled_query = (
        select(Post)
        .join(ScheduledPost, ScheduledPost.post_id == Post.id)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            PostPlatform.social_account_id == social_account_id,
            Post.status == "scheduled",
            Post.user_id == user_id,
            ScheduledPost.status == "pending",
        )
        .options(
            selectinload(Post.post_media).selectinload(PostMedia.media_asset),
            selectinload(Post.scheduled_post),
        )
        .order_by(ScheduledPost.scheduled_time.asc())
    )

    count_scheduled_query = (
        select(func.count())
        .select_from(Post)
        .join(ScheduledPost, ScheduledPost.post_id == Post.id)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            PostPlatform.social_account_id == social_account_id,
            Post.status == "scheduled",
            Post.user_id == user_id,
            ScheduledPost.status == "pending",
        )
    )

    # Execute all queries
    scheduled_result = await db.execute(scheduled_query)
    scheduled_posts = list(scheduled_result.scalars().unique().all())

    total_scheduled_result = await db.execute(count_scheduled_query)
    total_scheduled = total_scheduled_result.scalar() or 0

    # Determine how many published posts to fetch (fill remaining grid slots)
    published_slots = max(0, limit - len(scheduled_posts))
    published_query = published_query.limit(published_slots)

    published_result = await db.execute(published_query)
    published_posts = list(published_result.scalars().unique().all())

    total_published_result = await db.execute(count_published_query)
    total_published = total_published_result.scalar() or 0

    # ---- Build the ordered grid ----
    # Scheduled posts appear first (they will be published in the future,
    # so they occupy the top rows of the grid), followed by already-published
    # posts in reverse chronological order.
    items = []
    position = 0

    for post in scheduled_posts:
        thumbnail_url = _extract_thumbnail(post)
        caption_preview = (post.caption or "")[:50]
        scheduled_time = (
            post.scheduled_post.scheduled_time if post.scheduled_post else None
        )
        items.append({
            "post_id": post.id,
            "thumbnail_url": thumbnail_url,
            "caption_preview": caption_preview,
            "status": "scheduled",
            "scheduled_time": scheduled_time,
            "grid_position": position,
            "row": position // GRID_COLUMNS,
            "col": position % GRID_COLUMNS,
        })
        position += 1

    for post in published_posts:
        thumbnail_url = _extract_thumbnail(post)
        caption_preview = (post.caption or "")[:50]
        items.append({
            "post_id": post.id,
            "thumbnail_url": thumbnail_url,
            "caption_preview": caption_preview,
            "status": "published",
            "scheduled_time": None,
            "grid_position": position,
            "row": position // GRID_COLUMNS,
            "col": position % GRID_COLUMNS,
        })
        position += 1

    return {
        "account_id": account.id,
        "items": items,
        "total_published": total_published,
        "total_scheduled": total_scheduled,
    }


def _extract_thumbnail(post: Post) -> str | None:
    """Extract the thumbnail URL from the first media asset of a post.

    Prefers the dedicated thumbnail_path; falls back to the original
    file_path for images.
    """
    if not post.post_media:
        return None

    # Sort by position to get the first media item
    sorted_media = sorted(post.post_media, key=lambda pm: pm.position)
    first = sorted_media[0]
    asset: MediaAsset | None = first.media_asset

    if asset is None:
        return None

    # Use thumbnail if available (e.g. for videos), else the file itself
    return asset.thumbnail_path or asset.file_path


async def reorder_scheduled_posts(
    social_account_id: str,
    user_id: str,
    ordered_post_ids: list[str],
    db: AsyncSession,
) -> dict:
    """Reorder scheduled posts by adjusting their scheduled_time values.

    The caller provides a list of post IDs in the desired display order
    (top-left to bottom-right). We redistribute the scheduled times so
    the chronological ordering matches the requested visual ordering,
    preserving the overall time window.

    Returns a dict with ``success`` and ``message`` keys.
    """
    await _validate_instagram_account(social_account_id, user_id, db)

    if not ordered_post_ids:
        raise BadRequestError("ordered_post_ids must not be empty")

    # Check for duplicates
    if len(ordered_post_ids) != len(set(ordered_post_ids)):
        raise BadRequestError("Duplicate post IDs in reorder list")

    # Fetch all referenced scheduled posts, ensuring they belong to the
    # user and target Instagram account.
    result = await db.execute(
        select(ScheduledPost)
        .join(Post, Post.id == ScheduledPost.post_id)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            Post.id.in_(ordered_post_ids),
            Post.user_id == user_id,
            Post.status == "scheduled",
            PostPlatform.social_account_id == social_account_id,
            ScheduledPost.status == "pending",
        )
        .options(selectinload(ScheduledPost.post))
    )
    scheduled_posts = list(result.scalars().unique().all())

    # Build lookup by post_id
    sp_by_post_id: dict[str, ScheduledPost] = {
        sp.post_id: sp for sp in scheduled_posts
    }

    # Verify all requested IDs were found
    missing = set(ordered_post_ids) - set(sp_by_post_id.keys())
    if missing:
        raise NotFoundError(
            f"Scheduled posts not found for post IDs: {', '.join(sorted(missing))}"
        )

    # Collect existing scheduled times in the order they were requested.
    # We will sort these times and reassign them to match the new order.
    existing_times: list[datetime] = sorted(
        sp.scheduled_time for sp in scheduled_posts
    )

    # Assign times: the first post in the new order gets the earliest
    # existing time, the second gets the next, etc.
    for idx, post_id in enumerate(ordered_post_ids):
        sp = sp_by_post_id[post_id]
        new_time = existing_times[idx]

        # If two posts would end up at the same second (rare), offset by
        # a small delta to maintain a strict ordering.
        if idx > 0 and new_time <= existing_times[idx - 1]:
            new_time = existing_times[idx - 1] + timedelta(seconds=1)

        sp.scheduled_time = new_time

    await db.flush()

    return {
        "success": True,
        "message": f"Successfully reordered {len(ordered_post_ids)} scheduled posts",
    }


async def get_grid_positions(
    social_account_id: str,
    user_id: str,
    db: AsyncSession,
) -> list[dict]:
    """Calculate where each scheduled post will appear in the 3-column grid.

    Takes into account the existing published posts so that scheduled
    posts slot in above them.  Returns a list of dicts with ``post_id``,
    ``grid_position``, ``row``, and ``col``.
    """
    await _validate_instagram_account(social_account_id, user_id, db)

    # Count how many published posts exist for this account
    count_query = (
        select(func.count())
        .select_from(Post)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            PostPlatform.social_account_id == social_account_id,
            PostPlatform.status == "published",
            Post.user_id == user_id,
        )
    )
    count_result = await db.execute(count_query)
    published_count = count_result.scalar() or 0

    # Fetch scheduled posts in chronological order
    scheduled_query = (
        select(Post.id, ScheduledPost.scheduled_time)
        .join(ScheduledPost, ScheduledPost.post_id == Post.id)
        .join(PostPlatform, PostPlatform.post_id == Post.id)
        .where(
            PostPlatform.social_account_id == social_account_id,
            Post.status == "scheduled",
            Post.user_id == user_id,
            ScheduledPost.status == "pending",
        )
        .order_by(ScheduledPost.scheduled_time.asc())
    )
    result = await db.execute(scheduled_query)
    scheduled_rows = result.all()

    positions: list[dict] = []
    for idx, row in enumerate(scheduled_rows):
        post_id = row[0]
        # Scheduled posts will be published in the future, so they
        # occupy position 0 .. N-1 in the grid (newest at top). The
        # *last* scheduled post to be published will be at position 0
        # once it's published, pushing earlier posts down. For the
        # preview we show them in publication order (soonest first is
        # at the top, i.e. position 0).
        grid_position = idx
        positions.append({
            "post_id": post_id,
            "grid_position": grid_position,
            "row": grid_position // GRID_COLUMNS,
            "col": grid_position % GRID_COLUMNS,
            "published_posts_below": published_count,
        })

    return positions
