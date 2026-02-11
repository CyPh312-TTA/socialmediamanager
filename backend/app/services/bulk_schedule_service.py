import csv
import io
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.post import Post, PostPlatform, ScheduledPost
from app.models.social_account import SocialAccount

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"caption", "platforms", "schedule_time"}
OPTIONAL_COLUMNS = {"hashtags", "post_type", "media_urls"}
ALL_COLUMNS = REQUIRED_COLUMNS | OPTIONAL_COLUMNS
VALID_POST_TYPES = {"feed", "reel", "story", "carousel"}

CSV_TEMPLATE_HEADER = "caption,hashtags,platforms,schedule_time,post_type,media_urls"
CSV_TEMPLATE_EXAMPLE = (
    '"My awesome post!","summer,vibes,travel","instagram,twitter",'
    '"2025-06-01T12:00:00Z","feed","https://example.com/img1.jpg,https://example.com/img2.jpg"'
)


def parse_csv(file_content: bytes) -> list[dict]:
    """Parse CSV bytes into a list of row dicts.

    Expected columns: caption, hashtags (comma-sep), platforms (comma-sep),
    schedule_time (ISO format), post_type, media_urls (comma-sep, optional).

    Returns a list of dicts with raw string values, one per row.
    """
    text = file_content.decode("utf-8-sig")  # handle BOM from Excel exports
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise ValueError("CSV file is empty or has no header row")

    normalised_fields = {f.strip().lower() for f in reader.fieldnames}
    missing = REQUIRED_COLUMNS - normalised_fields
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

    entries: list[dict] = []
    for row_num, raw_row in enumerate(reader, start=2):  # row 1 is the header
        # Normalise keys to lowercase / stripped
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        caption = row.get("caption", "")
        if not caption:
            entries.append({"row_number": row_num, "error": "Caption is required"})
            continue

        hashtags_raw = row.get("hashtags", "")
        hashtags = [
            h.strip().lstrip("#") for h in hashtags_raw.split(",") if h.strip()
        ] if hashtags_raw else []

        platforms_raw = row.get("platforms", "")
        platforms = [p.strip().lower() for p in platforms_raw.split(",") if p.strip()]
        if not platforms:
            entries.append({
                "row_number": row_num,
                "error": "At least one platform is required",
            })
            continue

        schedule_time = row.get("schedule_time", "")
        if not schedule_time:
            entries.append({
                "row_number": row_num,
                "error": "schedule_time is required",
            })
            continue

        post_type = row.get("post_type", "feed").strip().lower() or "feed"

        media_urls_raw = row.get("media_urls", "")
        media_urls = [
            u.strip() for u in media_urls_raw.split(",") if u.strip()
        ] if media_urls_raw else []

        entries.append({
            "row_number": row_num,
            "caption": caption,
            "hashtags": hashtags,
            "platforms": platforms,
            "schedule_time": schedule_time,
            "post_type": post_type,
            "media_urls": media_urls if media_urls else None,
        })

    return entries


async def validate_bulk_entries(
    entries: list[dict],
    user_id: str,
    db: AsyncSession,
) -> tuple[list[dict], list[dict]]:
    """Validate parsed CSV entries.

    Returns (valid_entries, error_entries).  Error entries include a
    ``row_number`` and ``error`` key.
    """
    # Fetch all active social accounts for the user, keyed by platform name
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == user_id,
            SocialAccount.is_active.is_(True),
        )
    )
    accounts = list(result.scalars().all())
    platform_to_accounts: dict[str, list[SocialAccount]] = {}
    for acct in accounts:
        platform_to_accounts.setdefault(acct.platform, []).append(acct)

    now = datetime.now(timezone.utc)
    valid: list[dict] = []
    errors: list[dict] = []

    for entry in entries:
        row_num = entry.get("row_number", 0)

        # If the entry was already marked as an error during parsing
        if "error" in entry and "caption" not in entry:
            errors.append(entry)
            continue

        # Validate schedule_time
        try:
            dt = datetime.fromisoformat(entry["schedule_time"])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt <= now:
                errors.append({
                    "row_number": row_num,
                    "error": "schedule_time must be in the future",
                })
                continue
        except (ValueError, TypeError):
            errors.append({
                "row_number": row_num,
                "error": f"Invalid schedule_time format: {entry.get('schedule_time')}",
            })
            continue

        # Validate post_type
        post_type = entry.get("post_type", "feed")
        if post_type not in VALID_POST_TYPES:
            errors.append({
                "row_number": row_num,
                "error": f"Invalid post_type '{post_type}'. Must be one of: {', '.join(sorted(VALID_POST_TYPES))}",
            })
            continue

        # Validate platforms -- user must have a connected account for each
        missing_platforms: list[str] = []
        for platform in entry["platforms"]:
            if platform not in platform_to_accounts:
                missing_platforms.append(platform)

        if missing_platforms:
            errors.append({
                "row_number": row_num,
                "error": f"No connected account for platform(s): {', '.join(missing_platforms)}",
            })
            continue

        # Entry is valid -- augment with resolved account IDs
        account_ids: list[str] = []
        for platform in entry["platforms"]:
            # Use the first active account for each platform
            account_ids.append(platform_to_accounts[platform][0].id)

        entry["account_ids"] = account_ids
        valid.append(entry)

    return valid, errors


async def create_bulk_posts(
    entries: list[dict],
    user_id: str,
    db: AsyncSession,
) -> dict:
    """Create Post + PostPlatform + ScheduledPost records for every valid entry.

    Returns a summary dict: {created: int, failed: int, errors: list[str]}.
    """
    created = 0
    failed = 0
    error_messages: list[str] = []

    for entry in entries:
        row_num = entry.get("row_number", "?")
        try:
            post = Post(
                user_id=user_id,
                caption=entry["caption"],
                hashtags=json.dumps(entry["hashtags"]) if entry.get("hashtags") else None,
                status="scheduled",
                post_type=entry.get("post_type", "feed"),
            )
            db.add(post)
            await db.flush()

            # Create PostPlatform for each target account
            account_ids = entry.get("account_ids", [])
            for account_id in account_ids:
                pp = PostPlatform(
                    post_id=post.id,
                    social_account_id=account_id,
                )
                db.add(pp)

            # Create ScheduledPost
            dt = datetime.fromisoformat(entry["schedule_time"])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)

            sp = ScheduledPost(
                post_id=post.id,
                scheduled_time=dt,
            )
            db.add(sp)
            await db.flush()

            created += 1

        except Exception as exc:
            failed += 1
            msg = f"Row {row_num}: {exc}"
            error_messages.append(msg)
            logger.exception("Failed to create bulk post for row %s", row_num)

    return {"created": created, "failed": failed, "errors": error_messages}


def generate_csv_template() -> str:
    """Return a CSV template string that users can fill in."""
    return f"{CSV_TEMPLATE_HEADER}\n{CSV_TEMPLATE_EXAMPLE}\n"
