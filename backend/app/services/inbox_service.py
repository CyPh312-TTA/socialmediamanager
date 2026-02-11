import logging
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.inbox import InboxMessage
from app.models.social_account import SocialAccount

logger = logging.getLogger(__name__)


async def fetch_inbox_messages(
    user_id: str,
    db: AsyncSession,
    platform: str | None = None,
    message_type: str | None = None,
    is_read: bool | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[InboxMessage], int, int]:
    """Query inbox messages with optional filters.

    Returns a tuple of (messages, total_count, unread_count).
    """
    base_filter = InboxMessage.user_id == user_id

    query = select(InboxMessage).where(base_filter)
    count_query = select(func.count()).select_from(InboxMessage).where(base_filter)
    unread_query = (
        select(func.count())
        .select_from(InboxMessage)
        .where(base_filter, InboxMessage.is_read.is_(False))
    )

    if platform:
        query = query.where(InboxMessage.platform == platform)
        count_query = count_query.where(InboxMessage.platform == platform)
        unread_query = unread_query.where(InboxMessage.platform == platform)

    if message_type:
        query = query.where(InboxMessage.message_type == message_type)
        count_query = count_query.where(InboxMessage.message_type == message_type)
        unread_query = unread_query.where(InboxMessage.message_type == message_type)

    if is_read is not None:
        query = query.where(InboxMessage.is_read == is_read)
        count_query = count_query.where(InboxMessage.is_read == is_read)

    if search:
        search_pattern = f"%{search}%"
        search_filter = InboxMessage.content.ilike(search_pattern) | InboxMessage.sender_username.ilike(search_pattern)
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
        unread_query = unread_query.where(search_filter)

    query = query.order_by(InboxMessage.received_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    items = list(result.scalars().all())

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    unread_result = await db.execute(unread_query)
    unread = unread_result.scalar() or 0

    return items, total, unread


async def mark_as_read(message_id: str, user_id: str, db: AsyncSession) -> InboxMessage:
    """Mark a single inbox message as read."""
    result = await db.execute(
        select(InboxMessage).where(
            InboxMessage.id == message_id,
            InboxMessage.user_id == user_id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise NotFoundError("Inbox message not found")

    message.is_read = True
    await db.flush()
    return message


async def mark_all_read(
    user_id: str, db: AsyncSession, platform: str | None = None
) -> int:
    """Mark all messages as read, optionally filtered by platform.

    Returns the number of messages updated.
    """
    stmt = (
        update(InboxMessage)
        .where(
            InboxMessage.user_id == user_id,
            InboxMessage.is_read.is_(False),
        )
        .values(is_read=True)
    )

    if platform:
        stmt = stmt.where(InboxMessage.platform == platform)

    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount


async def get_unread_counts(user_id: str, db: AsyncSession) -> dict:
    """Get unread message counts grouped by platform and by message type.

    Returns dict with keys: by_platform, by_type, total.
    """
    base_filter = (
        InboxMessage.user_id == user_id,
        InboxMessage.is_read.is_(False),
    )

    # Count by platform
    platform_query = (
        select(InboxMessage.platform, func.count())
        .where(*base_filter)
        .group_by(InboxMessage.platform)
    )
    platform_result = await db.execute(platform_query)
    by_platform = {row[0]: row[1] for row in platform_result.all()}

    # Count by message type
    type_query = (
        select(InboxMessage.message_type, func.count())
        .where(*base_filter)
        .group_by(InboxMessage.message_type)
    )
    type_result = await db.execute(type_query)
    by_type = {row[0]: row[1] for row in type_result.all()}

    total = sum(by_platform.values())

    return {
        "by_platform": by_platform,
        "by_type": by_type,
        "total": total,
    }


async def reply_to_message(
    message_id: str, reply_text: str, user_id: str, db: AsyncSession
) -> InboxMessage:
    """Mark a message as replied. Actual platform API reply will be added later."""
    result = await db.execute(
        select(InboxMessage).where(
            InboxMessage.id == message_id,
            InboxMessage.user_id == user_id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise NotFoundError("Inbox message not found")

    message.is_replied = True
    message.is_read = True
    await db.flush()

    logger.info(
        "Reply queued for message %s on %s (type=%s): %s",
        message_id,
        message.platform,
        message.message_type,
        reply_text[:100],
    )

    # TODO: Dispatch actual reply via platform API
    # e.g. twitter_client.reply_to_comment(message.platform_message_id, reply_text)

    return message


async def sync_inbox_from_platform(
    social_account: SocialAccount, db: AsyncSession
) -> int:
    """Placeholder: fetch new messages from a platform API and store them.

    In a full implementation, this would:
    1. Use the platform client to fetch comments, DMs, and mentions.
    2. Deduplicate against existing platform_message_id entries.
    3. Insert new InboxMessage rows.
    4. Return the count of newly synced messages.
    """
    logger.info(
        "sync_inbox_from_platform called for account %s (%s / %s) - placeholder, no messages fetched",
        social_account.id,
        social_account.platform,
        social_account.platform_username,
    )

    # TODO: Implement per-platform fetching:
    # - Twitter: GET /2/users/:id/mentions, GET /2/dm_events
    # - Instagram: GET /{media-id}/comments, GET /me/conversations
    # - Facebook: GET /{post-id}/comments, GET /me/conversations
    # - TikTok: GET /v2/comment/list/

    return 0
