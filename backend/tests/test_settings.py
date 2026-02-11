"""Tests for settings endpoints."""

import pytest
from httpx import AsyncClient


class TestProfileUpdate:
    """PUT /api/v1/settings/profile"""

    async def test_update_name(self, client: AsyncClient, auth_headers: dict):
        resp = await client.put(
            "/api/v1/settings/profile",
            headers=auth_headers,
            json={"full_name": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    async def test_update_email(self, client: AsyncClient, auth_headers: dict):
        resp = await client.put(
            "/api/v1/settings/profile",
            headers=auth_headers,
            json={"email": "updated@example.com"},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "updated@example.com"

    async def test_update_no_auth(self, client: AsyncClient):
        resp = await client.put(
            "/api/v1/settings/profile",
            json={"full_name": "Hacker"},
        )
        assert resp.status_code == 401


class TestPasswordChange:
    """POST /api/v1/settings/change-password"""

    async def test_change_password_success(self, client: AsyncClient):
        import uuid

        unique = uuid.uuid4().hex[:8]
        email = f"pwchange_{unique}@example.com"

        # Register
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "oldpass123", "full_name": "PW User"},
        )
        # Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "oldpass123"},
        )
        headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

        # Change password
        resp = await client.post(
            "/api/v1/settings/change-password",
            headers=headers,
            json={"current_password": "oldpass123", "new_password": "newpass456"},
        )
        assert resp.status_code == 200
        assert "successfully" in resp.json()["message"].lower()

        # Verify old password no longer works
        login_resp2 = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "oldpass123"},
        )
        assert login_resp2.status_code == 401

        # Verify new password works
        login_resp3 = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "newpass456"},
        )
        assert login_resp3.status_code == 200

    async def test_change_password_wrong_current(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/settings/change-password",
            headers=auth_headers,
            json={"current_password": "wrongwrong", "new_password": "newpass456"},
        )
        assert resp.status_code == 400

    async def test_change_password_too_short(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/settings/change-password",
            headers=auth_headers,
            json={"current_password": "testpass123", "new_password": "short"},
        )
        assert resp.status_code == 400


class TestPreferences:
    """GET/PUT /api/v1/settings/preferences"""

    async def test_get_default_preferences(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            "/api/v1/settings/preferences",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_tone"] == "professional"
        assert data["default_hashtag_count"] == 20
        assert data["auto_hashtags"] is False

    async def test_update_preferences(self, client: AsyncClient, auth_headers: dict):
        resp = await client.put(
            "/api/v1/settings/preferences",
            headers=auth_headers,
            json={
                "default_tone": "casual",
                "default_hashtag_count": 10,
                "auto_hashtags": True,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_tone"] == "casual"
        assert data["default_hashtag_count"] == 10
        assert data["auto_hashtags"] is True
