import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.core.security import decrypt_token
from app.models.media_asset import MediaAsset
from app.models.post import Post, PostMedia, PostPlatform, ScheduledPost
from app.models.social_account import SocialAccount
from app.models.user import User
from app.platforms.base import SocialPlatformBase
from app.platforms.meta import MetaPlatform
from app.platforms.tiktok import TikTokPlatform
from app.platforms.twitter import TwitterPlatform
from app.schemas.post import PostCreate, PostUpdate
from app.utils.health_monitor import health_monitor
from app.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)


def get_platform_client(account: SocialAccount) -> SocialPlatformBase:
    """Create a platform adapter from a social account."""
    token = decrypt_token(account.access_token)

    if account.platform == "twitter":
        return TwitterPlatform(access_token=token)
    elif account.platform in ("instagram", "facebook"):
        return MetaPlatform(
            access_token=token,
            platform=account.platform,
            platform_user_id=account.platform_user_id,
            meta_page_id=account.meta_page_id,
        )
    elif account.platform == "tiktok":
        return TikTokPlatform(access_token=token)
    else:
        raise BadRequestError(f"Unsupported platform: {account.platform}")


async def create_post(data: PostCreate, user: User, db: AsyncSession) -> Post:
    """Create a new post (draft, scheduled, or publish immediately)."""
    # Validate account IDs belong to user
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id.in_(data.account_ids),
            SocialAccount.user_id == user.id,
            SocialAccount.is_active.is_(True),
        )
    )
    accounts = list(result.scalars().all())
    if len(accounts) != len(data.account_ids):
        raise BadRequestError("One or more social accounts not found or inactive")

    # Validate media IDs
    media_assets = []
    if data.media_ids:
        result = await db.execute(
            select(MediaAsset).where(
                MediaAsset.id.in_(data.media_ids),
                MediaAsset.user_id == user.id,
            )
        )
        media_assets = list(result.scalars().all())
        if len(media_assets) != len(data.media_ids):
            raise BadRequestError("One or more media assets not found")

    # Create post
    post = Post(
        user_id=user.id,
        caption=data.caption,
        hashtags=json.dumps(data.hashtags) if data.hashtags else None,
        status="draft",
        post_type=data.post_type,
    )
    db.add(post)
    await db.flush()

    # Attach media
    for i, asset in enumerate(media_assets):
        pm = PostMedia(post_id=post.id, media_asset_id=asset.id, position=i)
        db.add(pm)

    # Create platform targets
    for account in accounts:
        custom_caption = (data.platform_captions or {}).get(account.id)
        pp = PostPlatform(
            post_id=post.id,
            social_account_id=account.id,
            platform_specific_caption=custom_caption,
        )
        db.add(pp)

    await db.flush()

    if data.schedule_time:
        post.status = "scheduled"
        sp = ScheduledPost(
            post_id=post.id,
            scheduled_time=data.schedule_time,
        )
        db.add(sp)
        await db.flush()
    elif data.publish_now:
        await _publish_post(post, accounts, media_assets, data.platform_captions, db)

    return post


async def _publish_post(
    post: Post,
    accounts: list[SocialAccount],
    media_assets: list[MediaAsset],
    platform_captions: dict[str, str] | None,
    db: AsyncSession,
) -> None:
    """Publish a post to all target platforms concurrently."""
    post.status = "publishing"
    await db.flush()

    media_paths = [a.file_path for a in media_assets]

    async def publish_to_account(account: SocialAccount) -> None:
        platform = account.platform
        acct_id = account.id

        # Check daily publish limit
        if not rate_limiter.can_publish(platform, acct_id):
            pp_result = await db.execute(
                select(PostPlatform).where(
                    PostPlatform.post_id == post.id,
                    PostPlatform.social_account_id == acct_id,
                )
            )
            pp = pp_result.scalar_one()
            pp.status = "failed"
            pp.error_message = f"Daily publish limit reached for {platform}"
            logger.warning("Daily publish limit reached for %s:%s", platform, acct_id)
            return

        # Acquire rate limit slot (waits if needed)
        await rate_limiter.acquire(platform, acct_id)

        client = get_platform_client(account)
        caption = (platform_captions or {}).get(account.id, post.caption)
        full_text = caption
        if post.hashtags:
            tags = json.loads(post.hashtags)
            full_text = f"{caption}\n\n{' '.join(f'#{t}' for t in tags)}"

        result = await client.publish_post(
            text=full_text,
            media_file_paths=media_paths if media_paths else None,
            post_type=post.post_type,
        )

        # Update PostPlatform record
        pp_result = await db.execute(
            select(PostPlatform).where(
                PostPlatform.post_id == post.id,
                PostPlatform.social_account_id == account.id,
            )
        )
        pp = pp_result.scalar_one()
        if result.success:
            pp.status = "published"
            pp.platform_post_id = result.platform_post_id
            pp.platform_media_ids = (
                json.dumps(result.platform_media_ids) if result.platform_media_ids else None
            )
            pp.published_at = datetime.now(timezone.utc)
            # Track success in rate limiter and health monitor
            rate_limiter.record_publish(platform, acct_id)
            health_monitor.record_publish(platform, acct_id)
        else:
            pp.status = "failed"
            pp.error_message = result.error_message
            health_monitor.record_error(platform, acct_id, result.error_message or "Unknown error")
            # Check for auth failures
            if result.error_message and ("401" in result.error_message or "403" in result.error_message):
                health_monitor.record_auth_failure(platform, acct_id)
            # Check for rate limit hits
            if result.error_message and "429" in result.error_message:
                rate_limiter.record_rate_limit_hit(platform, acct_id)

    # Publish to all platforms concurrently
    await asyncio.gather(*[publish_to_account(acc) for acc in accounts], return_exceptions=True)

    # Determine overall status
    pp_result = await db.execute(
        select(PostPlatform).where(PostPlatform.post_id == post.id)
    )
    platform_statuses = list(pp_result.scalars().all())
    statuses = [pp.status for pp in platform_statuses]

    if all(s == "published" for s in statuses):
        post.status = "published"
    elif all(s == "failed" for s in statuses):
        post.status = "failed"
    else:
        post.status = "published"  # partial success

    await db.flush()


async def list_posts(
    user: User, db: AsyncSession, status: str | None = None, skip: int = 0, limit: int = 50
) -> tuple[list[Post], int]:
    query = (
        select(Post)
        .options(
            selectinload(Post.post_platforms).selectinload(PostPlatform.social_account),
            selectinload(Post.scheduled_post),
        )
        .where(Post.user_id == user.id)
    )
    count_query = select(func.count()).select_from(Post).where(Post.user_id == user.id)

    if status:
        query = query.where(Post.status == status)
        count_query = count_query.where(Post.status == status)

    query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return items, total


async def get_post(post_id: str, user: User, db: AsyncSession) -> Post:
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.post_platforms).selectinload(PostPlatform.social_account),
            selectinload(Post.scheduled_post),
        )
        .where(Post.id == post_id, Post.user_id == user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found")
    return post


async def update_post(post_id: str, data: PostUpdate, user: User, db: AsyncSession) -> Post:
    """Update a draft or scheduled post."""
    post = await get_post(post_id, user, db)

    if post.status not in ("draft", "scheduled"):
        raise BadRequestError("Only draft or scheduled posts can be updated")

    if data.caption is not None:
        post.caption = data.caption
    if data.hashtags is not None:
        post.hashtags = json.dumps(data.hashtags) if data.hashtags else None
    if data.post_type is not None:
        post.post_type = data.post_type

    # Update media if provided
    if data.media_ids is not None:
        # Validate media IDs
        if data.media_ids:
            result = await db.execute(
                select(MediaAsset).where(
                    MediaAsset.id.in_(data.media_ids),
                    MediaAsset.user_id == user.id,
                )
            )
            media_assets = list(result.scalars().all())
            if len(media_assets) != len(data.media_ids):
                raise BadRequestError("One or more media assets not found")

        # Remove existing media links
        existing_media = await db.execute(
            select(PostMedia).where(PostMedia.post_id == post.id)
        )
        for pm in existing_media.scalars().all():
            await db.delete(pm)

        # Add new media links
        for i, media_id in enumerate(data.media_ids):
            pm = PostMedia(post_id=post.id, media_asset_id=media_id, position=i)
            db.add(pm)

    # Handle schedule time changes
    if data.schedule_time is not None:
        sp = post.scheduled_post
        if sp:
            # Update existing scheduled post
            sp.scheduled_time = data.schedule_time
            sp.status = "pending"
        else:
            # Create new scheduled post entry
            sp = ScheduledPost(
                post_id=post.id,
                scheduled_time=data.schedule_time,
            )
            db.add(sp)
        post.status = "scheduled"

    await db.flush()
    return post


async def cancel_scheduled_post(post_id: str, user: User, db: AsyncSession) -> Post:
    """Cancel a scheduled post, reverting it to draft status."""
    post = await get_post(post_id, user, db)

    if post.status != "scheduled":
        raise BadRequestError("Only scheduled posts can be cancelled")

    sp = post.scheduled_post
    if sp:
        sp.status = "cancelled"

    post.status = "draft"
    await db.flush()
    return post


async def delete_post(post_id: str, user: User, db: AsyncSession) -> None:
    post = await get_post(post_id, user, db)
    await db.delete(post)
