"""Background jobs: reminders every minute, smart rules hourly and just after midnight."""

from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.db import SessionLocal
from app.services import rules
from app.services.reminders import broadcaster, due_reminders

_last_check: datetime | None = None


async def check_reminders() -> None:
    global _last_check
    now = datetime.now()
    since = _last_check or now - timedelta(minutes=2)
    with SessionLocal() as session:
        for event in due_reminders(session, since, now):
            broadcaster.publish(event)
    _last_check = now


async def run_rules() -> None:
    now = datetime.now()
    with SessionLocal() as session:
        moved = rules.rollover_overdue(session, now)
        bumped = rules.bump_priorities(session, now)
    if moved or bumped:
        broadcaster.publish({"type": "refresh", "moved": moved, "bumped": bumped})


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(check_reminders, "interval", seconds=30, id="reminders", max_instances=1, coalesce=True)
    scheduler.add_job(run_rules, "cron", minute=1, id="rules", max_instances=1, coalesce=True)
    scheduler.add_job(run_rules, "date", id="rules-startup")
    return scheduler
