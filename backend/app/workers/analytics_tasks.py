"""Celery tasks for periodic analytics fetching."""

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.analytics_tasks.fetch_all_metrics")
def fetch_all_metrics():
    """Periodic task to fetch metrics for all active accounts."""
    import asyncio

    asyncio.run(_async_fetch_all())


async def _async_fetch_all():
    import logging

    from sqlalchemy import select

    from app.db.session import async_session
    from app.models.social_account import SocialAccount
    from app.services.analytics_service import fetch_platform_metrics

    logger = logging.getLogger(__name__)

    async with async_session() as db:
        result = await db.execute(
            select(SocialAccount).where(SocialAccount.is_active.is_(True))
        )
        accounts = result.scalars().all()

        for account in accounts:
            try:
                metrics = await fetch_platform_metrics(account.id, db)
                logger.info("Fetched metrics for %s (%s): %s", account.platform_username, account.platform, metrics)
            except Exception as e:
                logger.error("Failed to fetch metrics for %s: %s", account.id, e)

        await db.commit()


@celery_app.task(name="app.workers.analytics_tasks.analyze_all_engagement")
def analyze_all_engagement():
    """Periodic task to analyze engagement patterns for all accounts."""
    import asyncio

    asyncio.run(_async_analyze_all())


async def _async_analyze_all():
    import logging

    from sqlalchemy import select

    from app.db.session import async_session
    from app.models.social_account import SocialAccount
    from app.services.best_time_service import analyze_engagement_patterns

    logger = logging.getLogger(__name__)

    async with async_session() as db:
        result = await db.execute(
            select(SocialAccount).where(SocialAccount.is_active.is_(True))
        )
        accounts = result.scalars().all()

        for account in accounts:
            try:
                slots = await analyze_engagement_patterns(account.id, db)
                logger.info(
                    "Analyzed engagement for %s (%s): %d slots",
                    account.platform_username,
                    account.platform,
                    slots,
                )
            except Exception as e:
                logger.error("Failed to analyze engagement for %s: %s", account.id, e)

        await db.commit()
