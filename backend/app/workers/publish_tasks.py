import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.publish_tasks.process_pending_scheduled_posts")
def process_pending_scheduled_posts():
    """Periodic task: scan for scheduled posts that are due and dispatch them."""
    import asyncio

    asyncio.run(_async_process_pending())


async def _async_process_pending():
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.db.session import async_session
    from app.models.post import ScheduledPost

    async with async_session() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(ScheduledPost).where(
                ScheduledPost.status == "pending",
                ScheduledPost.scheduled_time <= now,
            )
        )
        due_posts = list(result.scalars().all())
        if not due_posts:
            return

        # Mark as processing to prevent re-dispatch
        post_ids = []
        for sp in due_posts:
            sp.status = "processing"
            post_ids.append(str(sp.post_id))
        await db.commit()

    # Dispatch each one to the publish task
    for post_id in post_ids:
        logger.info("Dispatching scheduled post %s for publishing", post_id)
        publish_scheduled_post.delay(post_id)


@celery_app.task(name="app.workers.publish_tasks.publish_scheduled_post")
def publish_scheduled_post(post_id: str):
    """Publish a scheduled post. Called by the poller or directly."""
    import asyncio

    asyncio.run(_async_publish(post_id))


async def _async_publish(post_id: str):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.db.session import async_session
    from app.models.post import Post, PostMedia, PostPlatform, ScheduledPost
    from app.services.post_service import _publish_post

    async with async_session() as db:
        result = await db.execute(
            select(Post)
            .options(
                selectinload(Post.post_platforms).selectinload(PostPlatform.social_account),
                selectinload(Post.post_media).selectinload(PostMedia.media_asset),
            )
            .where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        if not post or post.status not in ("scheduled",):
            logger.info("Post %s not found or not in scheduled state, skipping", post_id)
            return

        # Check if the scheduled post was cancelled in the meantime
        sp_result = await db.execute(
            select(ScheduledPost).where(ScheduledPost.post_id == post_id)
        )
        sp = sp_result.scalar_one_or_none()
        if sp and sp.status == "cancelled":
            logger.info("Post %s was cancelled, skipping publish", post_id)
            return

        accounts = [pp.social_account for pp in post.post_platforms]
        media_assets = [pm.media_asset for pm in post.post_media]

        await _publish_post(post, accounts, media_assets, None, db)

        # Update scheduled post status
        if sp:
            sp.status = "completed"

        await db.commit()
        logger.info("Published scheduled post %s", post_id)


@celery_app.task(name="app.workers.publish_tasks.refresh_expiring_tokens")
def refresh_expiring_tokens():
    """Periodic task to refresh tokens expiring within 24 hours."""
    import asyncio
    asyncio.run(_async_refresh_tokens())


async def _async_refresh_tokens():
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select

    from app.core.security import decrypt_token, encrypt_token
    from app.db.session import async_session
    from app.models.social_account import SocialAccount
    from app.services.post_service import get_platform_client

    async with async_session() as db:
        threshold = datetime.now(timezone.utc) + timedelta(hours=24)
        result = await db.execute(
            select(SocialAccount).where(
                SocialAccount.is_active.is_(True),
                SocialAccount.token_expires_at.isnot(None),
                SocialAccount.token_expires_at <= threshold,
                SocialAccount.refresh_token.isnot(None),
            )
        )

        for account in result.scalars().all():
            try:
                client = get_platform_client(account)
                refresh_token = decrypt_token(account.refresh_token)
                new_tokens = await client.refresh_access_token(refresh_token)

                account.access_token = encrypt_token(new_tokens.access_token)
                if new_tokens.refresh_token:
                    account.refresh_token = encrypt_token(new_tokens.refresh_token)
                if new_tokens.expires_in:
                    account.token_expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=new_tokens.expires_in
                    )
            except Exception:
                account.is_active = False

        await db.commit()
