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
        "process-scheduled-posts-every-60s": {
            "task": "app.workers.publish_tasks.process_pending_scheduled_posts",
            "schedule": 60.0,  # every 60 seconds
        },
        "refresh-tokens-every-6-hours": {
            "task": "app.workers.publish_tasks.refresh_expiring_tokens",
            "schedule": 21600.0,  # 6 hours
        },
        "fetch-metrics-every-4-hours": {
            "task": "app.workers.analytics_tasks.fetch_all_metrics",
            "schedule": 14400.0,  # 4 hours
        },
        "analyze-engagement-daily": {
            "task": "app.workers.analytics_tasks.analyze_all_engagement",
            "schedule": 86400.0,  # 24 hours
        },
    },
)

celery_app.autodiscover_tasks(["app.workers"])
