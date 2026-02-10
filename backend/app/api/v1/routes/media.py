from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.media import MediaAssetResponse, MediaListResponse
from app.services import media_service

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", response_model=MediaAssetResponse, status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await media_service.upload_media(file, user, db)
    return asset


@router.get("/", response_model=MediaListResponse)
async def list_media(
    media_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await media_service.list_media(
        user, db, media_type=media_type, skip=skip, limit=limit
    )
    return MediaListResponse(items=items, total=total)


@router.get("/{media_id}", response_model=MediaAssetResponse)
async def get_media(
    media_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await media_service.get_media(media_id, user, db)


@router.delete("/{media_id}", status_code=204)
async def delete_media(
    media_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await media_service.delete_media(media_id, user, db)
