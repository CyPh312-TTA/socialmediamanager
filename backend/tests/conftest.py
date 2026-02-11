"""Shared test fixtures for the backend test suite.

Uses a real PostgreSQL test database (social_media_manager_test) to verify
actual SQL, constraints, and migrations.

Strategy: each test gets a fresh AsyncClient. The app's get_db dependency
is overridden to create a fresh session per request (mirroring production),
backed by the test database engine. Tables are truncated after each test
for clean isolation.
"""

import os
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── Override settings BEFORE any app import ─────────────────────────────────
os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://jarvis@localhost:5432/social_media_manager_test"
)
os.environ["APP_ENV"] = "test"
os.environ["ANTHROPIC_API_KEY"] = "test-key-not-real"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-for-testing"
os.environ["FERNET_KEY"] = "uD31ThfwWWgq6nzAtIQeAV2sNSPJAEPsTJLUDkMEshI="

from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402

# ── Test DB URL ──────────────────────────────────────────────────────────────
TEST_DATABASE_URL = os.environ["DATABASE_URL"]


# ── Create / drop tables once per session ────────────────────────────────────
@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Create all tables at session start, drop at session end."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    yield
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── Per-test truncate for isolation ──────────────────────────────────────────
@pytest_asyncio.fixture(autouse=True)
async def clean_tables():
    """Truncate all tables after each test for full isolation."""
    yield
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        # Truncate all app tables (cascade handles FK constraints)
        table_names = [t.name for t in reversed(Base.metadata.sorted_tables)]
        if table_names:
            await conn.execute(
                text(f"TRUNCATE {', '.join(table_names)} CASCADE")
            )
    await engine.dispose()


# ── Per-test client ──────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def client():
    """Provide an httpx AsyncClient wired to the FastAPI app with test DB.

    Each call to get_db creates a fresh session from the test engine,
    mirroring production behaviour. No shared session = no concurrent-op issues.
    """
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    test_session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await test_engine.dispose()


# ── Helper: register + login, return headers ─────────────────────────────────
@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register a test user and return Authorization headers."""
    unique = uuid.uuid4().hex[:8]
    email = f"test_{unique}@example.com"

    # Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "full_name": "QA Tester",
        },
    )
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "testpass123"},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"

    tokens = login_resp.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
