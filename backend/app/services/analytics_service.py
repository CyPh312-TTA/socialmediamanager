import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsSnapshot
from app.models.post import Post, PostPlatform
from app.models.social_account import SocialAccount
from app.schemas.analytics import (
    AnalyticsDashboard,
    AnalyticsOverview,
    DailyMetric,
    PlatformBreakdown,
    PostPerformance,
)

logger = logging.getLogger(__name__)


async def get_dashboard(
    user_id: str, db: AsyncSession, days: int = 30
) -> AnalyticsDashboard:
    """Build the full analytics dashboard for a user."""

    cutoff = date.today() - timedelta(days=days)

    # Get user's social accounts
    acct_result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == user_id,
            SocialAccount.is_active.is_(True),
        )
    )
    accounts = list(acct_result.scalars().all())
    account_ids = [a.id for a in accounts]

    # --- Overview ---
    total_posts_result = await db.execute(
        select(func.count(Post.id)).where(Post.user_id == user_id)
    )
    total_posts = total_posts_result.scalar() or 0

    published_result = await db.execute(
        select(func.count(Post.id)).where(
            Post.user_id == user_id, Post.status == "published"
        )
    )
    total_published = published_result.scalar() or 0

    # Aggregate metrics from snapshots
    agg_metrics = {"impressions": 0, "reach": 0, "likes": 0, "comments": 0, "shares": 0}
    total_followers = 0

    if account_ids:
        # Latest account-level snapshots for followers
        for acct in accounts:
            follower_result = await db.execute(
                select(AnalyticsSnapshot)
                .where(
                    AnalyticsSnapshot.social_account_id == acct.id,
                    AnalyticsSnapshot.metric_type == "account",
                )
                .order_by(AnalyticsSnapshot.snapshot_date.desc())
                .limit(1)
            )
            latest = follower_result.scalar_one_or_none()
            if latest:
                total_followers += latest.followers_count

        # Aggregate post-level snapshots for the date range
        snap_result = await db.execute(
            select(AnalyticsSnapshot).where(
                AnalyticsSnapshot.social_account_id.in_(account_ids),
                AnalyticsSnapshot.metric_type == "post",
                AnalyticsSnapshot.snapshot_date >= cutoff,
            )
        )
        for snap in snap_result.scalars().all():
            agg_metrics["impressions"] += snap.impressions
            agg_metrics["reach"] += snap.reach
            agg_metrics["likes"] += snap.likes
            agg_metrics["comments"] += snap.comments
            agg_metrics["shares"] += snap.shares

    total_engagement = agg_metrics["likes"] + agg_metrics["comments"] + agg_metrics["shares"]
    avg_engagement = (
        (total_engagement / agg_metrics["impressions"] * 100)
        if agg_metrics["impressions"] > 0
        else 0.0
    )

    overview = AnalyticsOverview(
        total_posts=total_posts,
        total_published=total_published,
        total_impressions=agg_metrics["impressions"],
        total_reach=agg_metrics["reach"],
        total_likes=agg_metrics["likes"],
        total_comments=agg_metrics["comments"],
        total_shares=agg_metrics["shares"],
        avg_engagement_rate=round(avg_engagement, 2),
        total_followers=total_followers,
    )

    # --- Platform Breakdown ---
    platform_breakdown: list[PlatformBreakdown] = []
    for acct in accounts:
        # Count published posts for this account
        pp_count_result = await db.execute(
            select(func.count(PostPlatform.id)).where(
                PostPlatform.social_account_id == acct.id,
                PostPlatform.status == "published",
            )
        )
        pp_count = pp_count_result.scalar() or 0

        # Aggregate snapshots for this account
        acct_snap_result = await db.execute(
            select(AnalyticsSnapshot).where(
                AnalyticsSnapshot.social_account_id == acct.id,
                AnalyticsSnapshot.metric_type == "post",
                AnalyticsSnapshot.snapshot_date >= cutoff,
            )
        )
        acct_metrics = {"impressions": 0, "reach": 0, "likes": 0, "comments": 0, "shares": 0}
        for snap in acct_snap_result.scalars().all():
            acct_metrics["impressions"] += snap.impressions
            acct_metrics["reach"] += snap.reach
            acct_metrics["likes"] += snap.likes
            acct_metrics["comments"] += snap.comments
            acct_metrics["shares"] += snap.shares

        acct_eng = (
            (acct_metrics["likes"] + acct_metrics["comments"] + acct_metrics["shares"])
        )
        acct_eng_rate = (
            (acct_eng / acct_metrics["impressions"] * 100)
            if acct_metrics["impressions"] > 0
            else 0.0
        )

        # Get latest follower count
        latest_snap = await db.execute(
            select(AnalyticsSnapshot)
            .where(
                AnalyticsSnapshot.social_account_id == acct.id,
                AnalyticsSnapshot.metric_type == "account",
            )
            .order_by(AnalyticsSnapshot.snapshot_date.desc())
            .limit(1)
        )
        latest = latest_snap.scalar_one_or_none()

        platform_breakdown.append(
            PlatformBreakdown(
                platform=acct.platform,
                platform_username=acct.platform_username,
                account_id=acct.id,
                posts_count=pp_count,
                impressions=acct_metrics["impressions"],
                reach=acct_metrics["reach"],
                likes=acct_metrics["likes"],
                comments=acct_metrics["comments"],
                shares=acct_metrics["shares"],
                followers=latest.followers_count if latest else 0,
                engagement_rate=round(acct_eng_rate, 2),
            )
        )

    # --- Top Posts ---
    top_posts: list[PostPerformance] = []
    if account_ids:
        top_snap_result = await db.execute(
            select(AnalyticsSnapshot)
            .where(
                AnalyticsSnapshot.social_account_id.in_(account_ids),
                AnalyticsSnapshot.metric_type == "post",
                AnalyticsSnapshot.post_platform_id.isnot(None),
                AnalyticsSnapshot.snapshot_date >= cutoff,
            )
            .order_by(AnalyticsSnapshot.engagement_rate.desc())
            .limit(10)
        )

        for snap in top_snap_result.scalars().all():
            # Get the post platform details
            pp_result = await db.execute(
                select(PostPlatform).where(PostPlatform.id == snap.post_platform_id)
            )
            pp = pp_result.scalar_one_or_none()
            if not pp:
                continue

            post_result = await db.execute(
                select(Post).where(Post.id == pp.post_id)
            )
            post = post_result.scalar_one_or_none()
            if not post:
                continue

            # Get the social account for the platform name
            sa_result = await db.execute(
                select(SocialAccount).where(SocialAccount.id == pp.social_account_id)
            )
            sa = sa_result.scalar_one_or_none()

            top_posts.append(
                PostPerformance(
                    post_id=post.id,
                    caption=post.caption[:100] + ("..." if len(post.caption) > 100 else ""),
                    platform=sa.platform if sa else "unknown",
                    published_at=pp.published_at,
                    impressions=snap.impressions,
                    reach=snap.reach,
                    likes=snap.likes,
                    comments=snap.comments,
                    shares=snap.shares,
                    engagement_rate=snap.engagement_rate,
                )
            )

    # --- Daily Metrics ---
    daily_metrics: list[DailyMetric] = []
    if account_ids:
        daily_result = await db.execute(
            select(AnalyticsSnapshot).where(
                AnalyticsSnapshot.social_account_id.in_(account_ids),
                AnalyticsSnapshot.metric_type == "post",
                AnalyticsSnapshot.snapshot_date >= cutoff,
            )
        )

        daily_data: dict[str, dict] = defaultdict(
            lambda: {"impressions": 0, "reach": 0, "likes": 0, "comments": 0, "engagement_rates": []}
        )
        for snap in daily_result.scalars().all():
            day_key = snap.snapshot_date.isoformat()
            daily_data[day_key]["impressions"] += snap.impressions
            daily_data[day_key]["reach"] += snap.reach
            daily_data[day_key]["likes"] += snap.likes
            daily_data[day_key]["comments"] += snap.comments
            if snap.engagement_rate > 0:
                daily_data[day_key]["engagement_rates"].append(snap.engagement_rate)

        for day_key in sorted(daily_data.keys()):
            d = daily_data[day_key]
            rates = d["engagement_rates"]
            avg_rate = sum(rates) / len(rates) if rates else 0.0
            daily_metrics.append(
                DailyMetric(
                    date=day_key,
                    impressions=d["impressions"],
                    reach=d["reach"],
                    likes=d["likes"],
                    comments=d["comments"],
                    engagement_rate=round(avg_rate, 2),
                )
            )

    return AnalyticsDashboard(
        overview=overview,
        platform_breakdown=platform_breakdown,
        top_posts=top_posts,
        daily_metrics=daily_metrics,
    )


async def fetch_platform_metrics(
    social_account_id: str, db: AsyncSession
) -> dict:
    """Fetch latest metrics from a platform and store as snapshots."""
    from app.services.post_service import get_platform_client

    account_result = await db.execute(
        select(SocialAccount).where(SocialAccount.id == social_account_id)
    )
    account = account_result.scalar_one_or_none()
    if not account or not account.is_active:
        return {"error": "Account not found or inactive"}

    try:
        client = get_platform_client(account)

        # Fetch account-level metrics
        acct_metrics = await client.get_account_metrics()

        today = date.today()
        snap = AnalyticsSnapshot(
            social_account_id=account.id,
            metric_type="account",
            followers_count=acct_metrics.followers_count,
            impressions=0,
            reach=0,
            likes=0,
            comments=0,
            shares=0,
            engagement_rate=0.0,
            snapshot_date=today,
        )
        db.add(snap)

        # Fetch post-level metrics for recent posts
        pp_result = await db.execute(
            select(PostPlatform).where(
                PostPlatform.social_account_id == account.id,
                PostPlatform.status == "published",
                PostPlatform.platform_post_id.isnot(None),
            )
        )
        post_metrics_count = 0
        for pp in pp_result.scalars().all():
            try:
                metrics = await client.get_post_metrics(pp.platform_post_id)
                total_eng = metrics.likes + metrics.comments + metrics.shares
                eng_rate = (total_eng / metrics.impressions * 100) if metrics.impressions > 0 else 0.0

                post_snap = AnalyticsSnapshot(
                    social_account_id=account.id,
                    post_platform_id=pp.id,
                    metric_type="post",
                    impressions=metrics.impressions,
                    reach=metrics.reach,
                    likes=metrics.likes,
                    comments=metrics.comments,
                    shares=metrics.shares,
                    engagement_rate=round(eng_rate, 2),
                    snapshot_date=today,
                )
                db.add(post_snap)
                post_metrics_count += 1
            except Exception as e:
                logger.warning("Failed to get metrics for post %s: %s", pp.platform_post_id, e)

        await db.flush()
        return {
            "account_id": account.id,
            "platform": account.platform,
            "followers": acct_metrics.followers_count,
            "posts_tracked": post_metrics_count,
        }
    except Exception as e:
        logger.error("Failed to fetch metrics for account %s: %s", social_account_id, e)
        return {"error": str(e)}
