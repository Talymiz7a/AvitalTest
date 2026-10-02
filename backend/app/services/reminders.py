"""Finding reminders that are due, and pushing them to open browser tabs."""

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Reminder, Task
from app.services import recurrence
from app.services.tasks import OPEN_STATUSES


def due_reminders(session: Session, since: datetime, now: datetime) -> list[dict]:
    """Reminders whose fire time is in (since, now]. Marks them fired so they never repeat."""
    tasks = session.scalars(select(Task).where(Task.reminders.any())).unique()
    fired = []
    for task in tasks:
        horizon = max(r.offset_minutes for r in task.reminders)
        for occ in recurrence.expand(task, since, now + timedelta(minutes=horizon) + timedelta(seconds=1)):
            if occ.status not in OPEN_STATUSES:
                continue
            for reminder in task.reminders:
                fire_at = occ.start - timedelta(minutes=reminder.offset_minutes)
                if since < fire_at <= now and reminder.last_fired_for != occ.start:
                    reminder.last_fired_for = occ.start
                    fired.append(_payload(task, occ, reminder))
    session.commit()
    return fired


def _payload(task: Task, occ: recurrence.Occurrence, reminder: Reminder) -> dict:
    return {
        "type": "reminder",
        "task_id": task.id,
        "title": task.title,
        "start": occ.start.isoformat(),
        "occurrence": occ.original.isoformat() if occ.original else None,
        "offset_minutes": reminder.offset_minutes,
        "priority": task.priority.value,
    }


class Broadcaster:
    """Fan-out of server events to every connected browser tab (SSE)."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._queues.discard(queue)

    def publish(self, event: dict) -> None:
        for queue in list(self._queues):
            if not queue.full():
                queue.put_nowait(event)


broadcaster = Broadcaster()
