import asyncio
import json

import httpx

from app.platforms.base import (
    AccountMetrics,
    OAuthTokens,
    PlatformPostResult,
    PostMetrics,
    SocialPlatformBase,
)

GRAPH_API_BASE = "https://graph.facebook.com/v22.0"


class MetaPlatform(SocialPlatformBase):
    """Adapter for both Instagram and Facebook via the Meta Graph API."""

    def __init__(
        self,
        access_token: str,
        platform: str,  # 'instagram' or 'facebook'
        platform_user_id: str,
        meta_page_id: str | None = None,
    ):
        self.access_token = access_token
        self.platform = platform
        self.platform_user_id = platform_user_id
        self.meta_page_id = meta_page_id
        self.params = {"access_token": access_token}

    async def _publish_instagram(
        self, text: str, media_file_urls: list[str] | None
    ) -> PlatformPostResult:
        """Instagram publish: create container -> poll -> publish."""
        ig_user_id = self.platform_user_id

        async with httpx.AsyncClient(timeout=60) as client:
            if not media_file_urls:
                return PlatformPostResult(
                    success=False,
                    error_message="Instagram requires at least one image or video",
                )

            if len(media_file_urls) == 1:
                # Single media post
                url = media_file_urls[0]
                is_video = any(url.lower().endswith(ext) for ext in [".mp4", ".mov"])

                container_data = {
                    **self.params,
                    "caption": text,
                }
                if is_video:
                    container_data["video_url"] = url
                    container_data["media_type"] = "REELS"
                else:
                    container_data["image_url"] = url

                resp = await client.post(
                    f"{GRAPH_API_BASE}/{ig_user_id}/media", data=container_data
                )
                if resp.status_code != 200:
                    return PlatformPostResult(
                        success=False, error_message=f"Container creation failed: {resp.text}"
                    )
                container_id = resp.json()["id"]

                # Poll for container readiness (required for video)
                if is_video:
                    for _ in range(30):
                        status_resp = await client.get(
                            f"{GRAPH_API_BASE}/{container_id}",
                            params={**self.params, "fields": "status_code"},
                        )
                        status = status_resp.json().get("status_code")
                        if status == "FINISHED":
                            break
                        if status == "ERROR":
                            return PlatformPostResult(
                                success=False, error_message="Video processing failed"
                            )
                        await asyncio.sleep(5)

                # Publish
                pub_resp = await client.post(
                    f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
                    data={**self.params, "creation_id": container_id},
                )
                if pub_resp.status_code == 200:
                    return PlatformPostResult(
                        success=True, platform_post_id=pub_resp.json()["id"]
                    )
                return PlatformPostResult(
                    success=False, error_message=f"Publish failed: {pub_resp.text}"
                )
            else:
                # Carousel post
                children_ids = []
                for url in media_file_urls:
                    is_video = any(url.lower().endswith(ext) for ext in [".mp4", ".mov"])
                    data = {
                        **self.params,
                        "is_carousel_item": "true",
                    }
                    if is_video:
                        data["video_url"] = url
                        data["media_type"] = "VIDEO"
                    else:
                        data["image_url"] = url

                    resp = await client.post(
                        f"{GRAPH_API_BASE}/{ig_user_id}/media", data=data
                    )
                    if resp.status_code == 200:
                        children_ids.append(resp.json()["id"])

                if not children_ids:
                    return PlatformPostResult(
                        success=False, error_message="No carousel items created"
                    )

                # Create carousel container
                carousel_resp = await client.post(
                    f"{GRAPH_API_BASE}/{ig_user_id}/media",
                    data={
                        **self.params,
                        "caption": text,
                        "media_type": "CAROUSEL",
                        "children": ",".join(children_ids),
                    },
                )
                if carousel_resp.status_code != 200:
                    return PlatformPostResult(
                        success=False, error_message=f"Carousel creation failed: {carousel_resp.text}"
                    )

                container_id = carousel_resp.json()["id"]
                pub_resp = await client.post(
                    f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
                    data={**self.params, "creation_id": container_id},
                )
                if pub_resp.status_code == 200:
                    return PlatformPostResult(
                        success=True,
                        platform_post_id=pub_resp.json()["id"],
                        platform_media_ids=children_ids,
                    )
                return PlatformPostResult(
                    success=False, error_message=f"Carousel publish failed: {pub_resp.text}"
                )

    async def _publish_facebook(
        self, text: str, media_file_paths: list[str] | None
    ) -> PlatformPostResult:
        """Facebook Page publish."""
        page_id = self.meta_page_id or self.platform_user_id

        async with httpx.AsyncClient(timeout=60) as client:
            if not media_file_paths:
                # Text-only post
                resp = await client.post(
                    f"{GRAPH_API_BASE}/{page_id}/feed",
                    data={**self.params, "message": text},
                )
                if resp.status_code == 200:
                    return PlatformPostResult(
                        success=True, platform_post_id=resp.json()["id"]
                    )
                return PlatformPostResult(
                    success=False, error_message=f"Facebook post failed: {resp.text}"
                )

            # Photo post (single)
            path = media_file_paths[0]
            with open(path, "rb") as f:
                resp = await client.post(
                    f"{GRAPH_API_BASE}/{page_id}/photos",
                    data={**self.params, "message": text},
                    files={"source": f},
                )
            if resp.status_code == 200:
                return PlatformPostResult(
                    success=True, platform_post_id=resp.json()["id"]
                )
            return PlatformPostResult(
                success=False, error_message=f"Facebook photo post failed: {resp.text}"
            )

    async def publish_post(
        self,
        text: str,
        media_file_paths: list[str] | None = None,
        post_type: str = "feed",
    ) -> PlatformPostResult:
        if self.platform == "instagram":
            # Instagram needs publicly accessible URLs, not file paths
            # In production, these would be pre-signed S3 URLs
            return await self._publish_instagram(text, media_file_paths)
        else:
            return await self._publish_facebook(text, media_file_paths)

    async def delete_post(self, platform_post_id: str) -> bool:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(
                f"{GRAPH_API_BASE}/{platform_post_id}",
                params=self.params,
            )
            return resp.status_code == 200

    async def get_post_metrics(self, platform_post_id: str) -> PostMetrics:
        async with httpx.AsyncClient(timeout=30) as client:
            if self.platform == "instagram":
                resp = await client.get(
                    f"{GRAPH_API_BASE}/{platform_post_id}/insights",
                    params={
                        **self.params,
                        "metric": "impressions,reach,likes,comments,shares,saved",
                    },
                )
                if resp.status_code == 200:
                    data = {
                        m["name"]: m["values"][0]["value"]
                        for m in resp.json().get("data", [])
                    }
                    return PostMetrics(
                        impressions=data.get("impressions", 0),
                        reach=data.get("reach", 0),
                        likes=data.get("likes", 0),
                        comments=data.get("comments", 0),
                        shares=data.get("shares", 0),
                        saves=data.get("saved", 0),
                    )
        return PostMetrics()

    async def get_account_metrics(self) -> AccountMetrics:
        async with httpx.AsyncClient(timeout=30) as client:
            if self.platform == "instagram":
                resp = await client.get(
                    f"{GRAPH_API_BASE}/{self.platform_user_id}",
                    params={**self.params, "fields": "followers_count,media_count"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return AccountMetrics(followers_count=data.get("followers_count", 0))
        return AccountMetrics()

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        """Exchange short-lived token for long-lived (Meta uses token exchange, not refresh_token)."""
        from app.core.config import settings

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.META_APP_ID,
                    "client_secret": settings.META_APP_SECRET,
                    "fb_exchange_token": refresh_token,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return OAuthTokens(
                    access_token=data["access_token"],
                    expires_in=data.get("expires_in"),
                )
            raise Exception(f"Meta token refresh failed: {resp.text}")
