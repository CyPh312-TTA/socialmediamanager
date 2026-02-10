import asyncio
import json
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
from app.schemas.post import PostCreate


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
        else:
            pp.status = "failed"
            pp.error_message = result.error_message

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
        .options(selectinload(Post.post_platforms).selectinload(PostPlatform.social_account))
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
        .options(selectinload(Post.post_platforms).selectinload(PostPlatform.social_account))
        .where(Post.id == post_id, Post.user_id == user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found")
    return post


async def delete_post(post_id: str, user: User, db: AsyncSession) -> None:
    post = await get_post(post_id, user, db)
    await db.delete(post)
