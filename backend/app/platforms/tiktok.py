import httpx

from app.platforms.base import (
    AccountMetrics,
    OAuthTokens,
    PlatformPostResult,
    PostMetrics,
    SocialPlatformBase,
)

TIKTOK_API_BASE = "https://open.tiktokapis.com/v2"


class TikTokPlatform(SocialPlatformBase):
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def publish_post(
        self,
        text: str,
        media_file_paths: list[str] | None = None,
        post_type: str = "feed",
    ) -> PlatformPostResult:
        """TikTok only supports video. Uses Direct Post API."""
        if not media_file_paths:
            return PlatformPostResult(
                success=False, error_message="TikTok requires a video file"
            )

        video_path = media_file_paths[0]

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                # Step 1: Initialize upload
                import os

                file_size = os.path.getsize(video_path)

                init_resp = await client.post(
                    f"{TIKTOK_API_BASE}/post/publish/video/init/",
                    headers=self.headers,
                    json={
                        "post_info": {
                            "title": text[:150],
                            "privacy_level": "SELF_ONLY",  # Start with private
                            "disable_duet": False,
                            "disable_comment": False,
                            "disable_stitch": False,
                        },
                        "source_info": {
                            "source": "FILE_UPLOAD",
                            "video_size": file_size,
                            "chunk_size": file_size,
                            "total_chunk_count": 1,
                        },
                    },
                )

                if init_resp.status_code != 200:
                    return PlatformPostResult(
                        success=False,
                        error_message=f"TikTok init failed: {init_resp.text}",
                    )

                data = init_resp.json().get("data", {})
                upload_url = data.get("upload_url")
                publish_id = data.get("publish_id")

                if not upload_url:
                    return PlatformPostResult(
                        success=False, error_message="No upload URL returned"
                    )

                # Step 2: Upload video
                with open(video_path, "rb") as f:
                    video_data = f.read()

                upload_resp = await client.put(
                    upload_url,
                    headers={
                        "Content-Type": "video/mp4",
                        "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                    },
                    content=video_data,
                )

                if upload_resp.status_code not in (200, 201):
                    return PlatformPostResult(
                        success=False,
                        error_message=f"TikTok upload failed: {upload_resp.text}",
                    )

                return PlatformPostResult(
                    success=True,
                    platform_post_id=publish_id,
                )

        except Exception as e:
            return PlatformPostResult(success=False, error_message=str(e))

    async def delete_post(self, platform_post_id: str) -> bool:
        # TikTok doesn't support deletion via API easily
        return False

    async def get_post_metrics(self, platform_post_id: str) -> PostMetrics:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{TIKTOK_API_BASE}/video/query/",
                headers=self.headers,
                json={"filters": {"video_ids": [platform_post_id]}},
            )
            if resp.status_code == 200:
                videos = resp.json().get("data", {}).get("videos", [])
                if videos:
                    v = videos[0]
                    return PostMetrics(
                        likes=v.get("like_count", 0),
                        comments=v.get("comment_count", 0),
                        shares=v.get("share_count", 0),
                        reach=v.get("view_count", 0),
                    )
        return PostMetrics()

    async def get_account_metrics(self) -> AccountMetrics:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{TIKTOK_API_BASE}/user/info/",
                headers=self.headers,
                params={"fields": "follower_count"},
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("user", {})
                return AccountMetrics(followers_count=data.get("follower_count", 0))
        return AccountMetrics()

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        from app.core.config import settings

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{TIKTOK_API_BASE}/oauth/token/",
                json={
                    "client_key": settings.TIKTOK_CLIENT_KEY,
                    "client_secret": settings.TIKTOK_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            if resp.status_code == 200:
                data = resp.json().get("data", resp.json())
                return OAuthTokens(
                    access_token=data["access_token"],
                    refresh_token=data.get("refresh_token"),
                    expires_in=data.get("expires_in"),
                )
            raise Exception(f"TikTok token refresh failed: {resp.text}")
