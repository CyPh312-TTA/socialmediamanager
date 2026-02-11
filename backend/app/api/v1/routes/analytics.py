from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.analytics import AnalyticsDashboard
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_dashboard(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full analytics dashboard."""
    return await analytics_service.get_dashboard(user.id, db, days=days)


@router.post("/refresh/{account_id}")
async def refresh_metrics(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger metrics refresh for a specific account."""
    result = await analytics_service.fetch_platform_metrics(account_id, db)
    await db.commit()
    return result
