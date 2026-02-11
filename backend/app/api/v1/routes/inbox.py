from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.inbox import (
    InboxListResponse,
    InboxMessageResponse,
    MarkAllReadRequest,
    ReplyRequest,
    UnreadCountsResponse,
)
from app.services import inbox_service

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/", response_model=InboxListResponse)
async def list_inbox_messages(
    platform: str | None = Query(None, description="Filter by platform (twitter, instagram, etc.)"),
    message_type: str | None = Query(None, description="Filter by type (comment, dm, mention, reply)"),
    is_read: bool | None = Query(None, description="Filter by read status"),
    search: str | None = Query(None, description="Search in message content and sender username"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total, unread = await inbox_service.fetch_inbox_messages(
        user_id=user.id,
        db=db,
        platform=platform,
        message_type=message_type,
        is_read=is_read,
        search=search,
        skip=skip,
        limit=limit,
    )
    return InboxListResponse(
        items=[InboxMessageResponse.model_validate(msg) for msg in items],
        total=total,
        unread=unread,
    )


@router.get("/unread-counts", response_model=UnreadCountsResponse)
async def get_unread_counts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    counts = await inbox_service.get_unread_counts(user_id=user.id, db=db)
    return UnreadCountsResponse(**counts)


@router.patch("/{message_id}/read", response_model=InboxMessageResponse)
async def mark_message_read(
    message_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await inbox_service.mark_as_read(
        message_id=message_id, user_id=user.id, db=db
    )
    return InboxMessageResponse.model_validate(message)


@router.post("/mark-all-read")
async def mark_all_messages_read(
    body: MarkAllReadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await inbox_service.mark_all_read(
        user_id=user.id, db=db, platform=body.platform
    )
    return {"updated": updated}


@router.post("/{message_id}/reply", response_model=InboxMessageResponse)
async def reply_to_message(
    message_id: str,
    body: ReplyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await inbox_service.reply_to_message(
        message_id=message_id,
        reply_text=body.reply_text,
        user_id=user.id,
        db=db,
    )
    return InboxMessageResponse.model_validate(message)
