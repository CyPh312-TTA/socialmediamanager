import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.media_asset import MediaAsset
from app.models.user import User

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB


async def upload_media(file: UploadFile, user: User, db: AsyncSession) -> MediaAsset:
    if not file.content_type:
        raise BadRequestError("Could not determine file type")

    is_image = file.content_type in ALLOWED_IMAGE_TYPES
    is_video = file.content_type in ALLOWED_VIDEO_TYPES

    if not is_image and not is_video:
        raise BadRequestError(
            f"Unsupported file type: {file.content_type}. "
            f"Allowed: {', '.join(ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES)}"
        )

    content = await file.read()
    file_size = len(content)

    if is_image and file_size > MAX_IMAGE_SIZE:
        raise BadRequestError(f"Image too large. Max size: {MAX_IMAGE_SIZE // (1024*1024)}MB")
    if is_video and file_size > MAX_VIDEO_SIZE:
        raise BadRequestError(f"Video too large. Max size: {MAX_VIDEO_SIZE // (1024*1024)}MB")

    ext = Path(file.filename or "upload").suffix or (".jpg" if is_image else ".mp4")
    unique_name = f"{uuid.uuid4()}{ext}"
    media_type = "image" if is_image else "video"
    subdir = "images" if is_image else "videos"

    user_dir = Path(settings.UPLOAD_DIR) / subdir
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / unique_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    width, height, duration = None, None, None
    thumbnail_path = None

    if is_image:
        try:
            with Image.open(file_path) as img:
                width, height = img.size
                # Generate thumbnail
                thumb_dir = Path(settings.UPLOAD_DIR) / "thumbnails"
                thumb_dir.mkdir(parents=True, exist_ok=True)
                thumb_path = thumb_dir / f"thumb_{unique_name}"
                img.thumbnail((300, 300))
                img.save(thumb_path)
                thumbnail_path = str(thumb_path)
        except Exception:
            pass

    if is_video:
        try:
            import ffmpeg

            probe = ffmpeg.probe(str(file_path))
            video_stream = next(
                (s for s in probe["streams"] if s["codec_type"] == "video"), None
            )
            if video_stream:
                width = int(video_stream.get("width", 0))
                height = int(video_stream.get("height", 0))
                duration = float(probe.get("format", {}).get("duration", 0))

            # Generate video thumbnail
            thumb_dir = Path(settings.UPLOAD_DIR) / "thumbnails"
            thumb_dir.mkdir(parents=True, exist_ok=True)
            thumb_name = f"thumb_{Path(unique_name).stem}.jpg"
            thumb_path = thumb_dir / thumb_name
            (
                ffmpeg.input(str(file_path), ss=1)
                .filter("scale", 300, -1)
                .output(str(thumb_path), vframes=1)
                .overwrite_output()
                .run(quiet=True)
            )
            thumbnail_path = str(thumb_path)
        except Exception:
            pass

    asset = MediaAsset(
        user_id=user.id,
        file_name=file.filename or unique_name,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=file.content_type,
        media_type=media_type,
        width=width,
        height=height,
        duration_seconds=duration,
        thumbnail_path=thumbnail_path,
    )
    db.add(asset)
    await db.flush()
    return asset


async def list_media(
    user: User, db: AsyncSession, media_type: str | None = None, skip: int = 0, limit: int = 50
) -> tuple[list[MediaAsset], int]:
    query = select(MediaAsset).where(MediaAsset.user_id == user.id)
    count_query = select(func.count()).select_from(MediaAsset).where(
        MediaAsset.user_id == user.id
    )

    if media_type:
        query = query.where(MediaAsset.media_type == media_type)
        count_query = count_query.where(MediaAsset.media_type == media_type)

    query = query.order_by(MediaAsset.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    items = list(result.scalars().all())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return items, total


async def get_media(media_id: str, user: User, db: AsyncSession) -> MediaAsset:
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.id == media_id, MediaAsset.user_id == user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundError("Media asset not found")
    return asset


async def delete_media(media_id: str, user: User, db: AsyncSession) -> None:
    asset = await get_media(media_id, user, db)

    # Delete files from disk
    for path in [asset.file_path, asset.thumbnail_path]:
        if path and os.path.exists(path):
            os.remove(path)

    await db.delete(asset)
