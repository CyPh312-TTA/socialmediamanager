from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "social_media_manager",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "refresh-tokens-every-6-hours": {
            "task": "app.workers.publish_tasks.refresh_expiring_tokens",
            "schedule": 21600.0,  # 6 hours
        },
    },
)

celery_app.autodiscover_tasks(["app.workers"])
