import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.first_comment import FirstComment
from app.models.post import PostPlatform

logger = logging.getLogger(__name__)


async def schedule_first_comment(
    post_platform_id: str,
    comment_text: str,
    delay_seconds: int,
    db: AsyncSession,
) -> FirstComment:
    """Create a FirstComment record to be posted after the parent post publishes.

    Args:
        post_platform_id: The PostPlatform entry this comment is attached to.
        comment_text: The text body for the first comment.
        delay_seconds: How many seconds to wait after the post publishes.
        db: Async database session.

    Returns:
        The newly created FirstComment instance.
    """
    # Verify the post_platform exists
    result = await db.execute(
        select(PostPlatform).where(PostPlatform.id == post_platform_id)
    )
    post_platform = result.scalar_one_or_none()
    if post_platform is None:
        raise NotFoundError(f"PostPlatform '{post_platform_id}' not found")

    # Check if a first comment already exists for this post_platform
    existing = await db.execute(
        select(FirstComment).where(
            FirstComment.post_platform_id == post_platform_id,
            FirstComment.status != "failed",
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise BadRequestError(
            "A first comment is already scheduled for this post platform entry"
        )

    first_comment = FirstComment(
        post_platform_id=post_platform_id,
        comment_text=comment_text,
        delay_seconds=delay_seconds,
    )
    db.add(first_comment)
    await db.flush()

    logger.info(
        "Scheduled first comment %s for post_platform %s (delay=%ds)",
        first_comment.id,
        post_platform_id,
        delay_seconds,
    )
    return first_comment


async def post_first_comment(
    first_comment_id: str,
    db: AsyncSession,
) -> FirstComment:
    """Post the first comment via the Instagram Graph API.

    This is a placeholder implementation that updates the status to ``posted``
    (or ``failed`` on error).  A real implementation would look up the
    platform post ID from the associated PostPlatform record, call the
    Instagram Graph API ``POST /{media-id}/comments``, and store the
    returned comment ID in ``platform_comment_id``.

    Args:
        first_comment_id: The FirstComment record to process.
        db: Async database session.

    Returns:
        The updated FirstComment instance.
    """
    result = await db.execute(
        select(FirstComment).where(FirstComment.id == first_comment_id)
    )
    first_comment = result.scalar_one_or_none()
    if first_comment is None:
        raise NotFoundError(f"FirstComment '{first_comment_id}' not found")

    if first_comment.status != "pending":
        raise BadRequestError(
            f"FirstComment is in '{first_comment.status}' state, expected 'pending'"
        )

    try:
        # ----- Placeholder: Instagram Graph API call -----
        # post_platform = await db.get(PostPlatform, first_comment.post_platform_id)
        # account = post_platform.social_account
        # token = decrypt_token(account.access_token)
        # media_id = post_platform.platform_post_id
        #
        # async with httpx.AsyncClient() as client:
        #     resp = await client.post(
        #         f"https://graph.facebook.com/v18.0/{media_id}/comments",
        #         params={"message": first_comment.comment_text, "access_token": token},
        #     )
        #     resp.raise_for_status()
        #     data = resp.json()
        #     first_comment.platform_comment_id = data["id"]
        # ----- End placeholder -----

        first_comment.status = "posted"
        first_comment.posted_at = datetime.now(timezone.utc)
        await db.flush()

        logger.info("Successfully posted first comment %s", first_comment_id)

    except Exception as exc:
        first_comment.status = "failed"
        first_comment.error_message = str(exc)
        await db.flush()
        logger.exception("Failed to post first comment %s", first_comment_id)

    return first_comment


async def get_pending_comments(db: AsyncSession) -> list[FirstComment]:
    """Return all FirstComment records that are still pending.

    This is intended to be called by a background worker or scheduler to
    find comments that need to be posted.
    """
    result = await db.execute(
        select(FirstComment).where(FirstComment.status == "pending")
    )
    return list(result.scalars().all())


async def get_first_comment_for_post_platform(
    post_platform_id: str,
    db: AsyncSession,
) -> FirstComment | None:
    """Fetch the first comment record associated with a given PostPlatform."""
    result = await db.execute(
        select(FirstComment).where(
            FirstComment.post_platform_id == post_platform_id
        )
    )
    return result.scalar_one_or_none()
