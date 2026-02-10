from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/socialmedia"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "changeme-jwt-secret"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # Encryption
    FERNET_KEY: str = "changeme-fernet-key"

    # Meta (Facebook + Instagram)
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_REDIRECT_URI: str = "http://localhost:8000/api/v1/accounts/meta/callback"

    # Twitter/X
    TWITTER_CLIENT_ID: str = ""
    TWITTER_CLIENT_SECRET: str = ""
    TWITTER_REDIRECT_URI: str = "http://localhost:8000/api/v1/accounts/twitter/callback"

    # TikTok
    TIKTOK_CLIENT_KEY: str = ""
    TIKTOK_CLIENT_SECRET: str = ""
    TIKTOK_REDIRECT_URI: str = "http://localhost:8000/api/v1/accounts/tiktok/callback"

    # AI
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-5-20250929"
    AI_MAX_TOKENS: int = 4096

    # Storage
    UPLOAD_DIR: str = "./uploads"

    # S3 (production)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "us-east-1"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
