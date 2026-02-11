from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.best_time import (
    AnalyzeResponse,
    BestTimesResponse,
    BestTimeSlot,
    HeatmapCell,
    HeatmapResponse,
)
from app.services import best_time_service

router = APIRouter(prefix="/best-times", tags=["best-times"])


@router.get("/{account_id}", response_model=BestTimesResponse)
async def get_best_times(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the top 5 best posting times for a social account."""
    platform, slots = await best_time_service.get_best_times(
        social_account_id=account_id, db=db, top_n=5
    )
    return BestTimesResponse(
        account_id=account_id,
        platform=platform,
        best_times=[
            BestTimeSlot(
                day_of_week=s.day_of_week,
                hour_utc=s.hour_utc,
                avg_engagement_rate=s.avg_engagement_rate,
                avg_impressions=s.avg_impressions,
                sample_count=s.sample_count,
            )
            for s in slots
        ],
    )


@router.get("/{account_id}/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the full 7x24 engagement heatmap grid for a social account."""
    platform, cells = await best_time_service.get_heatmap_data(
        social_account_id=account_id, db=db
    )
    return HeatmapResponse(
        account_id=account_id,
        platform=platform,
        data=[
            HeatmapCell(
                day_of_week=c["day_of_week"],
                hour_utc=c["hour_utc"],
                value=c["value"],
            )
            for c in cells
        ],
    )


@router.post("/{account_id}/analyze", response_model=AnalyzeResponse)
async def analyze_engagement(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a fresh analysis of engagement patterns for a social account."""
    slots_updated = await best_time_service.analyze_engagement_patterns(
        social_account_id=account_id, db=db
    )

    # Retrieve platform from the service helper
    platform, _ = await best_time_service.get_best_times(
        social_account_id=account_id, db=db, top_n=0
    )

    return AnalyzeResponse(
        account_id=account_id,
        platform=platform,
        slots_updated=slots_updated,
        message=(
            f"Analysis complete. {slots_updated} time slots updated."
            if slots_updated > 0
            else "No post-level analytics data found for this account."
        ),
    )
