from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.publish_tasks.publish_scheduled_post")
def publish_scheduled_post(post_id: str):
    """Publish a scheduled post. Called by Celery with eta."""
    import asyncio
    asyncio.run(_async_publish(post_id))


async def _async_publish(post_id: str):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.db.session import async_session
    from app.models.media_asset import MediaAsset
    from app.models.post import Post, PostMedia, PostPlatform, ScheduledPost
    from app.models.social_account import SocialAccount
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
        if not post or post.status != "scheduled":
            return

        accounts = [pp.social_account for pp in post.post_platforms]
        media_assets = [pm.media_asset for pm in post.post_media]

        await _publish_post(post, accounts, media_assets, None, db)

        # Update scheduled post status
        sp_result = await db.execute(
            select(ScheduledPost).where(ScheduledPost.post_id == post_id)
        )
        sp = sp_result.scalar_one_or_none()
        if sp:
            sp.status = "completed"

        await db.commit()


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
