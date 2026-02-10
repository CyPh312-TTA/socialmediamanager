import secrets
from urllib.parse import urlencode

import httpx

from app.core.config import settings

META_AUTH_URL = "https://www.facebook.com/v22.0/dialog/oauth"
META_TOKEN_URL = "https://graph.facebook.com/v22.0/oauth/access_token"
META_GRAPH_URL = "https://graph.facebook.com/v22.0"

_oauth_states: dict[str, dict] = {}


def generate_oauth_url(user_id: str) -> str:
    """Generate Meta OAuth authorization URL."""
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"user_id": user_id}

    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.META_REDIRECT_URI,
        "state": state,
        "scope": (
            "instagram_basic,instagram_content_publish,instagram_manage_insights,"
            "pages_show_list,pages_read_engagement,pages_manage_posts"
        ),
        "response_type": "code",
    }

    return f"{META_AUTH_URL}?{urlencode(params)}"


async def handle_callback(code: str, state: str) -> list[dict]:
    """
    Exchange code for tokens and discover connected Instagram + Facebook accounts.
    Returns a list of account dicts (may include both Instagram and Facebook).
    """
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient(timeout=30) as client:
        # Exchange code for short-lived token
        token_resp = await client.get(
            META_TOKEN_URL,
            params={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "redirect_uri": settings.META_REDIRECT_URI,
                "code": code,
            },
        )
        if token_resp.status_code != 200:
            raise ValueError(f"Token exchange failed: {token_resp.text}")

        short_token = token_resp.json()["access_token"]

        # Exchange for long-lived token (60 days)
        long_resp = await client.get(
            META_TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_token,
            },
        )
        if long_resp.status_code != 200:
            raise ValueError(f"Long-lived token exchange failed: {long_resp.text}")

        long_token_data = long_resp.json()
        access_token = long_token_data["access_token"]
        expires_in = long_token_data.get("expires_in")

        # Fetch user's Facebook pages
        pages_resp = await client.get(
            f"{META_GRAPH_URL}/me/accounts",
            params={"access_token": access_token, "fields": "id,name,access_token"},
        )

        accounts = []

        if pages_resp.status_code == 200:
            pages = pages_resp.json().get("data", [])
            for page in pages:
                page_token = page["access_token"]

                # Facebook page account
                accounts.append({
                    "user_id": state_data["user_id"],
                    "platform": "facebook",
                    "access_token": page_token,
                    "refresh_token": access_token,
                    "expires_in": expires_in,
                    "platform_user_id": page["id"],
                    "platform_username": page["name"],
                    "meta_page_id": page["id"],
                })

                # Check for linked Instagram Business account
                ig_resp = await client.get(
                    f"{META_GRAPH_URL}/{page['id']}",
                    params={
                        "access_token": page_token,
                        "fields": "instagram_business_account{id,username}",
                    },
                )
                if ig_resp.status_code == 200:
                    ig_data = ig_resp.json().get("instagram_business_account")
                    if ig_data:
                        accounts.append({
                            "user_id": state_data["user_id"],
                            "platform": "instagram",
                            "access_token": page_token,
                            "refresh_token": access_token,
                            "expires_in": expires_in,
                            "platform_user_id": ig_data["id"],
                            "platform_username": ig_data.get("username", ""),
                            "meta_page_id": page["id"],
                        })

        return accounts
