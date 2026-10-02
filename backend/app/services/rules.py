"""Rule-based 'smart' behaviour that runs on a schedule."""

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Priority, Task
from app.services.settings import get_settings
from app.services.tasks import OPEN_STATUSES


def _open_one_off():
    return select(Task).where(Task.rrule.is_(None), Task.status.in_(OPEN_STATUSES))


def rollover_overdue(session: Session, now: datetime) -> int:
    """Move open tasks marked 'move to today' from past days to today, keeping their time of day."""
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tasks = session.scalars(
        _open_one_off().where(Task.rollover.is_(True), func.coalesce(Task.start_at, Task.due_at) < today)
    ).unique()
    moved = 0
    for task in tasks:
        delta = timedelta(days=(today.date() - task.anchor.date()).days)
        task.start_at = task.start_at + delta if task.start_at else None
        task.due_at = task.due_at + delta if task.due_at else None
        moved += 1
    session.commit()
    return moved


def bump_priorities(session: Session, now: datetime) -> int:
    """Raise priority one level for open tasks due within 24 hours (once per task)."""
    if not get_settings(session).auto_priority_bump:
        return 0
    due = func.coalesce(Task.due_at, Task.start_at)
    tasks = session.scalars(
        _open_one_off().where(
            Task.auto_bumped.is_(False),
            Task.priority != Priority.urgent,
            due >= now,
            due <= now + timedelta(hours=24),
        )
    ).unique()
    bumped = 0
    for task in tasks:
        task.priority = task.priority.bumped()
        task.auto_bumped = True
        bumped += 1
    session.commit()
    return bumped
