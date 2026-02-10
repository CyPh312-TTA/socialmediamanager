from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ai import (
    CalendarRequest,
    CalendarResponse,
    CaptionRequest,
    CaptionResponse,
    HashtagRequest,
    HashtagResponse,
    RewriteRequest,
    RewriteResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate-caption", response_model=CaptionResponse)
async def generate_caption(
    data: CaptionRequest,
    user: User = Depends(get_current_user),
):
    return await ai_service.generate_caption(data)


@router.post("/generate-hashtags", response_model=HashtagResponse)
async def generate_hashtags(
    data: HashtagRequest,
    user: User = Depends(get_current_user),
):
    return await ai_service.generate_hashtags(data)


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_for_platform(
    data: RewriteRequest,
    user: User = Depends(get_current_user),
):
    return await ai_service.rewrite_for_platform(data)


@router.post("/generate-calendar", response_model=CalendarResponse)
async def generate_calendar(
    data: CalendarRequest,
    user: User = Depends(get_current_user),
):
    return await ai_service.generate_calendar(data)
