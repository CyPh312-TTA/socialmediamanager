"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient


class TestRegister:
    """POST /api/v1/auth/register"""

    async def test_register_success(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepass123",
                "full_name": "New User",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@example.com"
        assert data["full_name"] == "New User"
        assert data["plan"] == "free"
        assert data["is_active"] is True
        assert "id" in data

    async def test_register_duplicate_email(self, client: AsyncClient):
        payload = {
            "email": "dupe@example.com",
            "password": "testpass123",
            "full_name": "Dupe User",
        }
        await client.post("/api/v1/auth/register", json=payload)
        resp = await client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()

    async def test_register_invalid_email(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "testpass123",
                "full_name": "Bad Email",
            },
        )
        assert resp.status_code == 422

    async def test_register_missing_fields(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "missing@example.com"},
        )
        assert resp.status_code == 422


class TestLogin:
    """POST /api/v1/auth/login"""

    async def test_login_success(self, client: AsyncClient):
        # Register first
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "login@example.com",
                "password": "testpass123",
                "full_name": "Login User",
            },
        )
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "login@example.com", "password": "testpass123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient):
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "wrongpw@example.com",
                "password": "testpass123",
                "full_name": "Wrong PW",
            },
        )
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrongpw@example.com", "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "testpass123"},
        )
        assert resp.status_code == 401


class TestGetMe:
    """GET /api/v1/auth/me"""

    async def test_get_me_authenticated(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"].endswith("@example.com")
        assert data["full_name"] == "QA Tester"
        assert data["is_active"] is True

    async def test_get_me_no_token(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_get_me_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-token-here"},
        )
        assert resp.status_code == 401


class TestTokenRefresh:
    """POST /api/v1/auth/refresh"""

    async def test_refresh_token_success(self, client: AsyncClient):
        # Register + login
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "refresh@example.com",
                "password": "testpass123",
                "full_name": "Refresh User",
            },
        )
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "refresh@example.com", "password": "testpass123"},
        )
        refresh_token = login_resp.json()["refresh_token"]

        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not-a-real-token"},
        )
        assert resp.status_code == 401
