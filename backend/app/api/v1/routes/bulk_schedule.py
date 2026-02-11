import logging

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.bulk_schedule import (
    BulkConfirmRequest,
    BulkPreviewEntry,
    BulkPreviewResponse,
    BulkResultResponse,
)
from app.services import bulk_schedule_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bulk", tags=["bulk-scheduling"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/upload", response_model=BulkPreviewResponse)
async def upload_csv(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV file and get a preview of what would be created.

    The response includes per-row validation results so the client can
    show which rows are valid and which have errors before confirming.
    """
    if file.content_type and file.content_type not in (
        "text/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        raise BadRequestError(
            f"Invalid file type '{file.content_type}'. Please upload a CSV file."
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise BadRequestError("File size exceeds the 5 MB limit")

    if not content.strip():
        raise BadRequestError("Uploaded file is empty")

    try:
        entries = bulk_schedule_service.parse_csv(content)
    except ValueError as exc:
        raise BadRequestError(str(exc))

    if not entries:
        raise BadRequestError("CSV file contains no data rows")

    valid_entries, error_entries = await bulk_schedule_service.validate_bulk_entries(
        entries, user.id, db
    )

    # Build preview entries
    preview: list[BulkPreviewEntry] = []

    for entry in valid_entries:
        preview.append(
            BulkPreviewEntry(
                row_number=entry["row_number"],
                caption=entry["caption"][:50],
                platforms=entry["platforms"],
                schedule_time=entry["schedule_time"],
                is_valid=True,
                error=None,
            )
        )

    for entry in error_entries:
        preview.append(
            BulkPreviewEntry(
                row_number=entry.get("row_number", 0),
                caption=entry.get("caption", "")[:50],
                platforms=entry.get("platforms", []),
                schedule_time=entry.get("schedule_time", ""),
                is_valid=False,
                error=entry.get("error"),
            )
        )

    # Sort by row number for a stable ordering
    preview.sort(key=lambda e: e.row_number)

    return BulkPreviewResponse(
        total_rows=len(preview),
        valid_count=len(valid_entries),
        error_count=len(error_entries),
        entries=preview,
    )


@router.post("/confirm", response_model=BulkResultResponse)
async def confirm_bulk(
    data: BulkConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create posts from previously validated CSV data.

    The client should send back the valid entries from the preview step
    (possibly after the user removed rows they don't want).
    """
    if not data.entries:
        raise BadRequestError("No entries provided")

    # Re-validate to guarantee safety (entries may have been tampered with)
    raw_entries = [entry.model_dump() for entry in data.entries]

    # Assign row numbers if not present
    for idx, entry in enumerate(raw_entries, start=1):
        entry.setdefault("row_number", idx)

    valid_entries, error_entries = await bulk_schedule_service.validate_bulk_entries(
        raw_entries, user.id, db
    )

    if error_entries:
        error_msgs = [
            f"Row {e.get('row_number', '?')}: {e.get('error', 'unknown error')}"
            for e in error_entries
        ]
        raise BadRequestError(
            f"Validation failed for {len(error_entries)} entries: {'; '.join(error_msgs)}"
        )

    result = await bulk_schedule_service.create_bulk_posts(valid_entries, user.id, db)

    return BulkResultResponse(
        created=result["created"],
        failed=result["failed"],
        errors=result["errors"],
    )


@router.get("/template")
async def download_template():
    """Download a CSV template file that can be filled in and uploaded."""
    csv_content = bulk_schedule_service.generate_csv_template()
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bulk_schedule_template.csv"},
    )
