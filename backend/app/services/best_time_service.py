import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsSnapshot
from app.models.best_time import EngagementByTime
from app.models.post import PostPlatform
from app.models.social_account import SocialAccount

logger = logging.getLogger(__name__)


async def _get_account(account_id: str, db: AsyncSession) -> SocialAccount:
    """Fetch a social account by ID or raise."""
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise ValueError(f"Social account {account_id} not found")
    return account


async def analyze_engagement_patterns(
    social_account_id: str, db: AsyncSession
) -> int:
    """Scan analytics snapshots for an account, group by day-of-week and hour,
    compute averages, and upsert into EngagementByTime.

    Returns the number of time-slot rows upserted.
    """
    account = await _get_account(social_account_id, db)

    # Fetch all post-level analytics snapshots for this account that have a
    # linked PostPlatform (so we can derive the publish hour).
    snapshots_result = await db.execute(
        select(AnalyticsSnapshot).where(
            AnalyticsSnapshot.social_account_id == social_account_id,
            AnalyticsSnapshot.metric_type == "post",
            AnalyticsSnapshot.post_platform_id.isnot(None),
        )
    )
    snapshots = list(snapshots_result.scalars().all())

    if not snapshots:
        logger.info(
            "No post-level analytics snapshots for account %s", social_account_id
        )
        return 0

    # Collect the PostPlatform IDs so we can look up published_at timestamps
    pp_ids = {s.post_platform_id for s in snapshots if s.post_platform_id}

    pp_result = await db.execute(
        select(PostPlatform).where(PostPlatform.id.in_(pp_ids))
    )
    pp_map: dict[str, PostPlatform] = {
        pp.id: pp for pp in pp_result.scalars().all()
    }

    # Bucket snapshots by (day_of_week, hour_utc)
    BucketKey = tuple[int, int]  # (day_of_week, hour_utc)
    buckets: dict[BucketKey, list[AnalyticsSnapshot]] = defaultdict(list)

    for snap in snapshots:
        pp = pp_map.get(snap.post_platform_id)  # type: ignore[arg-type]
        if pp is None or pp.published_at is None:
            # Fall back to the snapshot_date (midnight) + created_at time if
            # published_at is unavailable.  Use created_at of the snapshot as
            # best proxy for when the post went live.
            ts = snap.created_at
        else:
            ts = pp.published_at

        day = ts.weekday()  # 0=Mon, 6=Sun
        hour = ts.hour
        buckets[(day, hour)].append(snap)

    # Compute averages per bucket and upsert into EngagementByTime
    # First, load all existing rows for this account so we can update in place
    existing_result = await db.execute(
        select(EngagementByTime).where(
            EngagementByTime.social_account_id == social_account_id
        )
    )
    existing_map: dict[BucketKey, EngagementByTime] = {
        (row.day_of_week, row.hour_utc): row
        for row in existing_result.scalars().all()
    }

    upserted = 0
    for (day, hour), snap_list in buckets.items():
        count = len(snap_list)
        avg_eng = sum(s.engagement_rate for s in snap_list) / count
        avg_imp = sum(s.impressions for s in snap_list) / count
        avg_rch = sum(s.reach for s in snap_list) / count

        existing = existing_map.get((day, hour))
        if existing:
            existing.avg_engagement_rate = avg_eng
            existing.avg_impressions = avg_imp
            existing.avg_reach = avg_rch
            existing.sample_count = count
            existing.updated_at = datetime.now(timezone.utc)
        else:
            row = EngagementByTime(
                id=str(uuid.uuid4()),
                social_account_id=social_account_id,
                platform=account.platform,
                day_of_week=day,
                hour_utc=hour,
                avg_engagement_rate=avg_eng,
                avg_impressions=avg_imp,
                avg_reach=avg_rch,
                sample_count=count,
                updated_at=datetime.now(timezone.utc),
            )
            db.add(row)

        upserted += 1

    await db.flush()
    logger.info(
        "Analyzed engagement for account %s: %d time slots updated",
        social_account_id,
        upserted,
    )
    return upserted


async def get_best_times(
    social_account_id: str,
    db: AsyncSession,
    top_n: int = 5,
) -> tuple[str, list[EngagementByTime]]:
    """Return the top N time slots by engagement rate for an account.

    Returns a tuple of (platform, list_of_slots).
    """
    account = await _get_account(social_account_id, db)

    result = await db.execute(
        select(EngagementByTime)
        .where(EngagementByTime.social_account_id == social_account_id)
        .order_by(EngagementByTime.avg_engagement_rate.desc())
        .limit(top_n)
    )
    slots = list(result.scalars().all())
    return account.platform, slots


async def get_heatmap_data(
    social_account_id: str,
    db: AsyncSession,
) -> tuple[str, list[dict]]:
    """Return the full 7x24 grid of engagement data for heatmap visualization.

    Missing slots are filled with 0.0 engagement rate so the frontend always
    receives a complete grid.

    Returns a tuple of (platform, list_of_cells).
    """
    account = await _get_account(social_account_id, db)

    result = await db.execute(
        select(EngagementByTime).where(
            EngagementByTime.social_account_id == social_account_id
        )
    )
    rows = list(result.scalars().all())

    # Build a lookup from existing data
    data_map: dict[tuple[int, int], float] = {
        (r.day_of_week, r.hour_utc): r.avg_engagement_rate for r in rows
    }

    # Build full 7x24 grid
    cells: list[dict] = []
    for day in range(7):
        for hour in range(24):
            cells.append(
                {
                    "day_of_week": day,
                    "hour_utc": hour,
                    "value": data_map.get((day, hour), 0.0),
                }
            )

    return account.platform, cells
