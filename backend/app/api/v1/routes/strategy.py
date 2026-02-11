import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.strategy import (
    PerformanceAnalysisRequest,
    PerformanceAnalysisResponse,
    PostIdeasRequest,
    PostIdeasResponse,
    StrategyQuestionnaire,
    StrategyResponse,
)
from app.services import strategy_copilot_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategy", tags=["strategy-copilot"])


@router.post("/generate", response_model=StrategyResponse)
async def generate_strategy(
    data: StrategyQuestionnaire,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StrategyResponse:
    """Generate a comprehensive content strategy from a questionnaire.

    Accepts business profile information and returns a full content strategy
    including pillars, weekly schedule, post ideas, hashtag strategy, and
    growth tactics.
    """
    try:
        result = await strategy_copilot_service.generate_content_strategy(
            answers=data.model_dump(),
            user_id=user.id,
            db=db,
        )
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Strategy generation failed for user %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate content strategy. Please try again later.",
        )


@router.post("/post-ideas", response_model=PostIdeasResponse)
async def generate_post_ideas(
    data: PostIdeasRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostIdeasResponse:
    """Generate specific post ideas based on an existing strategy context.

    Provide the strategy summary and desired platform to receive
    ready-to-use post concepts with captions, hashtags, and post types.
    """
    try:
        ideas = await strategy_copilot_service.generate_post_ideas(
            strategy_context=data.strategy_context,
            count=data.count,
            platform=data.platform,
            user_id=user.id,
            db=db,
        )
        return PostIdeasResponse(ideas=ideas)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Post idea generation failed for user %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate post ideas. Please try again later.",
        )


@router.post("/analyze", response_model=PerformanceAnalysisResponse)
async def analyze_performance(
    data: PerformanceAnalysisRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PerformanceAnalysisResponse:
    """Analyze past content performance and get improvement suggestions.

    Submit historical post data with engagement metrics to receive
    data-driven insights, recommendations, and identification of
    top-performing content types.
    """
    if not data.post_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="post_data must contain at least one entry.",
        )
    try:
        result = await strategy_copilot_service.analyze_content_performance(
            post_data=data.post_data,
            user_id=user.id,
            db=db,
        )
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Performance analysis failed for user %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze performance. Please try again later.",
        )
