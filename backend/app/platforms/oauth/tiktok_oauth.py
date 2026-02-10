import secrets
from urllib.parse import urlencode

import httpx

from app.core.config import settings

TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_USER_URL = "https://open.tiktokapis.com/v2/user/info/"

_oauth_states: dict[str, dict] = {}


def generate_oauth_url(user_id: str) -> str:
    """Generate TikTok OAuth authorization URL."""
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"user_id": user_id}

    params = {
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "response_type": "code",
        "scope": "user.info.basic,video.publish,video.upload",
        "redirect_uri": settings.TIKTOK_REDIRECT_URI,
        "state": state,
    }

    return f"{TIKTOK_AUTH_URL}?{urlencode(params)}"


async def handle_callback(code: str, state: str) -> dict:
    """Exchange authorization code for tokens and fetch user profile."""
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient(timeout=30) as client:
        # Exchange code for tokens
        token_resp = await client.post(
            TIKTOK_TOKEN_URL,
            json={
                "client_key": settings.TIKTOK_CLIENT_KEY,
                "client_secret": settings.TIKTOK_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.TIKTOK_REDIRECT_URI,
            },
        )

        if token_resp.status_code != 200:
            raise ValueError(f"Token exchange failed: {token_resp.text}")

        token_data = token_resp.json().get("data", token_resp.json())

        # Fetch user profile
        user_resp = await client.get(
            TIKTOK_USER_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
            params={"fields": "open_id,display_name,avatar_url,username"},
        )

        if user_resp.status_code != 200:
            raise ValueError(f"Failed to fetch user profile: {user_resp.text}")

        user_data = user_resp.json().get("data", {}).get("user", {})

        return {
            "user_id": state_data["user_id"],
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
            "scopes": "user.info.basic,video.publish,video.upload",
            "platform_user_id": token_data.get("open_id", user_data.get("open_id", "")),
            "platform_username": user_data.get("display_name", user_data.get("username", "")),
        }
