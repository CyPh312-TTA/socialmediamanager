import json
import mimetypes
from pathlib import Path

import httpx

from app.platforms.base import (
    AccountMetrics,
    OAuthTokens,
    PlatformPostResult,
    PostMetrics,
    SocialPlatformBase,
)

TWITTER_API_BASE = "https://api.x.com/2"
TWITTER_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json"


class TwitterPlatform(SocialPlatformBase):
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {"Authorization": f"Bearer {access_token}"}

    async def _upload_media(self, file_path: str) -> str | None:
        """Upload media to Twitter and return media_id."""
        path = Path(file_path)
        mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        file_size = path.stat().st_size
        is_video = mime_type.startswith("video/")

        async with httpx.AsyncClient(timeout=120) as client:
            if is_video:
                # Chunked upload for videos
                # INIT
                init_resp = await client.post(
                    TWITTER_UPLOAD_URL,
                    headers=self.headers,
                    data={
                        "command": "INIT",
                        "total_bytes": file_size,
                        "media_type": mime_type,
                        "media_category": "tweet_video",
                    },
                )
                if init_resp.status_code != 202 and init_resp.status_code != 200:
                    return None
                media_id = init_resp.json()["media_id_string"]

                # APPEND chunks
                chunk_size = 5 * 1024 * 1024  # 5MB
                with open(file_path, "rb") as f:
                    segment = 0
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        await client.post(
                            TWITTER_UPLOAD_URL,
                            headers=self.headers,
                            data={"command": "APPEND", "media_id": media_id, "segment_index": segment},
                            files={"media": chunk},
                        )
                        segment += 1

                # FINALIZE
                fin_resp = await client.post(
                    TWITTER_UPLOAD_URL,
                    headers=self.headers,
                    data={"command": "FINALIZE", "media_id": media_id},
                )
                if fin_resp.status_code not in (200, 201):
                    return None

                # Poll for processing status
                processing = fin_resp.json().get("processing_info")
                while processing and processing.get("state") != "succeeded":
                    if processing.get("state") == "failed":
                        return None
                    wait_secs = processing.get("check_after_secs", 5)
                    import asyncio
                    await asyncio.sleep(wait_secs)
                    status_resp = await client.get(
                        TWITTER_UPLOAD_URL,
                        headers=self.headers,
                        params={"command": "STATUS", "media_id": media_id},
                    )
                    processing = status_resp.json().get("processing_info")

                return media_id
            else:
                # Simple upload for images
                with open(file_path, "rb") as f:
                    resp = await client.post(
                        TWITTER_UPLOAD_URL,
                        headers=self.headers,
                        files={"media": (path.name, f, mime_type)},
                    )
                if resp.status_code in (200, 201):
                    return resp.json()["media_id_string"]
                return None

    async def publish_post(
        self,
        text: str,
        media_file_paths: list[str] | None = None,
        post_type: str = "feed",
    ) -> PlatformPostResult:
        try:
            payload: dict = {"text": text}

            if media_file_paths:
                media_ids = []
                for path in media_file_paths:
                    media_id = await self._upload_media(path)
                    if media_id:
                        media_ids.append(media_id)

                if media_ids:
                    payload["media"] = {"media_ids": media_ids}

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{TWITTER_API_BASE}/tweets",
                    headers={**self.headers, "Content-Type": "application/json"},
                    json=payload,
                )

                if resp.status_code in (200, 201):
                    data = resp.json()["data"]
                    return PlatformPostResult(
                        success=True,
                        platform_post_id=data["id"],
                        platform_media_ids=payload.get("media", {}).get("media_ids"),
                    )
                else:
                    return PlatformPostResult(
                        success=False,
                        error_message=f"Twitter API error {resp.status_code}: {resp.text}",
                    )
        except Exception as e:
            return PlatformPostResult(success=False, error_message=str(e))

    async def delete_post(self, platform_post_id: str) -> bool:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(
                f"{TWITTER_API_BASE}/tweets/{platform_post_id}",
                headers=self.headers,
            )
            return resp.status_code == 200

    async def get_post_metrics(self, platform_post_id: str) -> PostMetrics:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{TWITTER_API_BASE}/tweets/{platform_post_id}",
                headers=self.headers,
                params={"tweet.fields": "public_metrics"},
            )
            if resp.status_code == 200:
                metrics = resp.json()["data"].get("public_metrics", {})
                return PostMetrics(
                    impressions=metrics.get("impression_count", 0),
                    likes=metrics.get("like_count", 0),
                    comments=metrics.get("reply_count", 0),
                    shares=metrics.get("retweet_count", 0) + metrics.get("quote_count", 0),
                    clicks=metrics.get("url_link_clicks", 0),
                )
        return PostMetrics()

    async def get_account_metrics(self) -> AccountMetrics:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{TWITTER_API_BASE}/users/me",
                headers=self.headers,
                params={"user.fields": "public_metrics"},
            )
            if resp.status_code == 200:
                metrics = resp.json()["data"].get("public_metrics", {})
                return AccountMetrics(
                    followers_count=metrics.get("followers_count", 0),
                )
        return AccountMetrics()

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        from app.core.config import settings

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.x.com/2/oauth2/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": settings.TWITTER_CLIENT_ID,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return OAuthTokens(
                    access_token=data["access_token"],
                    refresh_token=data.get("refresh_token"),
                    expires_in=data.get("expires_in"),
                )
            raise Exception(f"Token refresh failed: {resp.text}")
