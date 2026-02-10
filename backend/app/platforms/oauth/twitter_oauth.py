import hashlib
import secrets
from base64 import urlsafe_b64encode
from urllib.parse import urlencode

import httpx

from app.core.config import settings

TWITTER_AUTH_URL = "https://x.com/i/oauth2/authorize"
TWITTER_TOKEN_URL = "https://api.x.com/2/oauth2/token"
TWITTER_USER_URL = "https://api.x.com/2/users/me"

# In-memory state store (use Redis in production)
_oauth_states: dict[str, dict] = {}


def generate_oauth_url(user_id: str) -> str:
    """Generate Twitter OAuth 2.0 PKCE authorization URL."""
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip("=")

    _oauth_states[state] = {
        "user_id": user_id,
        "code_verifier": code_verifier,
    }

    params = {
        "response_type": "code",
        "client_id": settings.TWITTER_CLIENT_ID,
        "redirect_uri": settings.TWITTER_REDIRECT_URI,
        "scope": "tweet.read tweet.write users.read offline.access media.write",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    return f"{TWITTER_AUTH_URL}?{urlencode(params)}"


async def handle_callback(code: str, state: str) -> dict:
    """Exchange authorization code for tokens and fetch user profile."""
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient(timeout=30) as client:
        # Exchange code for tokens
        token_resp = await client.post(
            TWITTER_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.TWITTER_REDIRECT_URI,
                "client_id": settings.TWITTER_CLIENT_ID,
                "code_verifier": state_data["code_verifier"],
            },
        )

        if token_resp.status_code != 200:
            raise ValueError(f"Token exchange failed: {token_resp.text}")

        token_data = token_resp.json()

        # Fetch user profile
        user_resp = await client.get(
            TWITTER_USER_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
            params={"user.fields": "username,name,profile_image_url"},
        )

        if user_resp.status_code != 200:
            raise ValueError(f"Failed to fetch user profile: {user_resp.text}")

        user_data = user_resp.json()["data"]

        return {
            "user_id": state_data["user_id"],
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
            "scopes": token_data.get("scope", ""),
            "platform_user_id": user_data["id"],
            "platform_username": user_data["username"],
        }
