from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure upload directories exist
    for subdir in ["images", "videos", "thumbnails"]:
        Path(settings.UPLOAD_DIR, subdir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="AI Social Media Manager",
    description="AI-powered social media management platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)

# Serve uploaded files in development
if settings.APP_ENV == "development":
    uploads_path = Path(settings.UPLOAD_DIR)
    if uploads_path.exists():
        app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
