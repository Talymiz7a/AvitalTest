"""Task create / edit / delete, including 'this / following / all' handling for repeating tasks."""

from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.errors import BadRequest, NotFound
from app.models import Category, ChecklistItem, Reminder, Tag, Task, TaskOccurrence, TaskStatus
from app.schemas import CalendarEvent, Scope, TaskCreate, TaskUpdate
from app.services import recurrence
from app.services.settings import get_settings

OPEN_STATUSES = (TaskStatus.todo, TaskStatus.in_progress)
SCALAR_FIELDS = (
    "title", "description", "start_at", "due_at", "all_day", "priority", "status",
    "category_id", "rrule", "rollover", "location",
)


def get_task(session: Session, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if task is None:
        raise NotFound("Task")
    return task


def _tags_by_name(session: Session, names: list[str]) -> list[Tag]:
    names = list(dict.fromkeys(n.strip() for n in names if n.strip()))
    if not names:
        return []
    existing = {t.name: t for t in session.scalars(select(Tag).where(Tag.name.in_(names)))}
    return [existing.get(n) or Tag(name=n) for n in names]


def _apply(session: Session, task: Task, data: dict) -> None:
    """Write validated fields onto a task (scalars, tags, checklist, reminders)."""
    for field in SCALAR_FIELDS:
        if field in data:
            setattr(task, field, data[field])
    if "category_id" in data:
        # Set the relationship too, so the returned task never shows a stale category.
        task.category = session.get(Category, data["category_id"]) if data["category_id"] is not None else None
    if "tags" in data:
        task.tags = _tags_by_name(session, data["tags"])
    if "checklist" in data:
        task.checklist = [
            ChecklistItem(text=i["text"], done=i.get("done", False), position=n) for n, i in enumerate(data["checklist"])
        ]
    if data.keys() & {"start_at", "due_at"}:
        task.auto_bumped = False
    if "reminders" in data and data["reminders"] is not None:
        task.reminders = [Reminder(offset_minutes=m) for m in sorted(set(data["reminders"])) if m >= 0]
    if task.start_at and task.due_at and task.due_at < task.start_at:
        raise BadRequest("End time must be after start time")
    if task.rrule and task.anchor is None:
        raise BadRequest("A repeating task needs a date")


def _snapshot(task: Task) -> dict:
    """A task's editable fields as plain data, used to clone it."""
    data = {f: getattr(task, f) for f in SCALAR_FIELDS}
    data["tags"] = [t.name for t in task.tags]
    data["checklist"] = [{"text": c.text, "done": c.done} for c in task.checklist]
    data["reminders"] = [r.offset_minutes for r in task.reminders]
    return data


def _check_category(session: Session, data: dict) -> None:
    if data.get("category_id") is not None and session.get(Category, data["category_id"]) is None:
        raise BadRequest("Category does not exist")


def create_task(session: Session, payload: TaskCreate) -> Task:
    data = payload.model_dump()
    _check_category(session, data)
    if data["reminders"] is None:
        data["reminders"] = get_settings(session).default_reminders.get(payload.priority, [])
    task = Task()
    _apply(session, task, data)
    session.add(task)
    session.commit()
    return task


def _shifted_times(task: Task, occurrence: datetime, data: dict) -> dict:
    """start_at/due_at for a task that begins at `occurrence`, unless the update sets them."""
    delta = occurrence - task.anchor
    times = {
        "start_at": task.start_at + delta if task.start_at else None,
        "due_at": task.due_at + delta if task.due_at else None,
    }
    times.update({k: data[k] for k in ("start_at", "due_at") if k in data})
    return times


def _require_occurrence(task: Task, occurrence: datetime | None) -> datetime:
    if occurrence is None:
        raise BadRequest("occurrence is required for a repeating task")
    if not recurrence.is_occurrence(task, occurrence):
        raise BadRequest("occurrence is not part of this task's schedule")
    return occurrence


def _override(session: Session, task: Task, original: datetime) -> TaskOccurrence:
    ov = next((o for o in task.occurrences if o.original_start == original), None)
    if ov is None:
        ov = TaskOccurrence(task=task, original_start=original)
        session.add(ov)
    return ov


def update_task(
    session: Session, task_id: int, payload: TaskUpdate, scope: Scope = Scope.all, occurrence: datetime | None = None
) -> Task:
    """Returns the task that now holds the edit (may be a new task when a series is split)."""
    task = get_task(session, task_id)
    data = payload.model_dump(exclude_unset=True)
    _check_category(session, data)

    if not task.rrule or scope == Scope.all:
        if task.rrule and ({"rrule", "start_at", "due_at"} & data.keys()):
            task.occurrences.clear()  # the schedule changed, so old one-off changes no longer line up
        _apply(session, task, data)
        session.commit()
        return task

    occurrence = _require_occurrence(task, occurrence)

    if scope == Scope.this:
        if data.keys() <= {"start_at", "due_at", "status"}:
            # Just moving or completing this one repeat: record an override.
            ov = _override(session, task, occurrence)
            if "start_at" in data:
                ov.new_start = data["start_at"]
            if "due_at" in data:
                if task.start_at is None:
                    ov.new_start = data["due_at"]  # due-only series: the due date is when the repeat happens
                else:
                    ov.new_due = data["due_at"]
            if "status" in data:
                ov.status = data["status"]
            session.commit()
            return task
        # Any other edit: detach this repeat into its own one-off task.
        new = Task()
        _apply(session, new, {**_snapshot(task), "rrule": None, "status": TaskStatus.todo,
                              **data, **_shifted_times(task, occurrence, data)})
        _override(session, task, occurrence).deleted = True
        session.add(new)
        session.commit()
        return new

    # Scope.following: end the old series before this occurrence and start a new one here.
    if occurrence == task.anchor:
        return update_task(session, task_id, payload, Scope.all)
    new = Task()
    _apply(session, new, {**_snapshot(task), "rrule": recurrence.remainder_from(task, occurrence),
                          **data, **_shifted_times(task, occurrence, data)})
    task.rrule = recurrence.truncate_before(task, occurrence)
    task.occurrences = [o for o in task.occurrences if o.original_start < occurrence]
    session.add(new)
    session.commit()
    return new


def delete_task(session: Session, task_id: int, scope: Scope = Scope.all, occurrence: datetime | None = None) -> None:
    """Deleting a task keeps its files in the Files library (they are just unlinked)."""
    task = get_task(session, task_id)
    if task.rrule and scope != Scope.all:
        occurrence = _require_occurrence(task, occurrence)
        if scope == Scope.this:
            _override(session, task, occurrence).deleted = True
            session.commit()
            return
        remaining = recurrence.truncate_before(task, occurrence)
        if remaining is not None:
            task.rrule = remaining
            task.occurrences = [o for o in task.occurrences if o.original_start < occurrence]
            session.commit()
            return
    session.delete(task)
    session.commit()


def set_status(session: Session, task_id: int, status: TaskStatus, occurrence: datetime | None) -> Task:
    task = get_task(session, task_id)
    if task.rrule:
        _override(session, task, _require_occurrence(task, occurrence)).status = status
    else:
        task.status = status
    session.commit()
    return task


def list_tasks(
    session: Session,
    *,
    q: str | None = None,
    status: list[TaskStatus] | None = None,
    priority: list[str] | None = None,
    category_id: int | None = None,
    tag: str | None = None,
    has_attachments: bool | None = None,
    sort: str = "anchor",
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Task], int]:
    stmt = select(Task)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Task.title.ilike(like), Task.description.ilike(like), Task.location.ilike(like)))
    if status:
        stmt = stmt.where(Task.status.in_(status))
    if priority:
        stmt = stmt.where(Task.priority.in_(priority))
    if category_id is not None:
        stmt = stmt.where(Task.category_id == category_id)
    if tag:
        stmt = stmt.where(Task.tags.any(Tag.name == tag))
    if has_attachments is not None:
        exists = Task.attachments.any()
        stmt = stmt.where(exists if has_attachments else ~exists)

    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    anchor = func.coalesce(Task.start_at, Task.due_at)
    order = {
        "anchor": (anchor.is_(None), anchor),
        "priority": (Task.priority.desc(),),
        "created": (Task.created_at.desc(),),
        "title": (Task.title,),
    }.get(sort, (anchor,))
    items = session.scalars(stmt.order_by(*order, Task.id).limit(limit).offset(offset)).unique().all()
    return list(items), total


def _event(task: Task, occ: recurrence.Occurrence) -> CalendarEvent:
    key = occ.original.isoformat() if occ.original else "single"
    return CalendarEvent(
        id=f"{task.id}:{key}",
        task_id=task.id,
        occurrence=occ.original,
        title=task.title,
        start=occ.start,
        end=occ.end,
        all_day=task.all_day,
        status=occ.status,
        priority=task.priority,
        color=task.category.color if task.category else None,
        category_id=task.category_id,
        recurring=bool(task.rrule),
        has_attachments=bool(task.attachments),
    )


def calendar(session: Session, frm: datetime, to: datetime) -> list[CalendarEvent]:
    """Every task occurrence overlapping [frm, to). Repeats are expanded only for this range."""
    anchor = func.coalesce(Task.start_at, Task.due_at)
    end = func.coalesce(Task.due_at, Task.start_at)
    stmt = select(Task).where(
        anchor.is_not(None),
        anchor < to,
        or_(Task.rrule.is_not(None), end >= frm),
    )
    events = [_event(t, occ) for t in session.scalars(stmt).unique() for occ in recurrence.expand(t, frm, to)]
    return sorted(events, key=lambda e: e.start)


def agenda(session: Session, now: datetime, days: int = 7) -> dict[str, list[CalendarEvent]]:
    """Overdue (open, before today), today, and the next `days` days."""
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    open_ = list(OPEN_STATUSES)

    overdue_one_off = session.scalars(
        select(Task).where(
            Task.rrule.is_(None), Task.status.in_(open_), func.coalesce(Task.start_at, Task.due_at) < today
        )
    ).unique()
    overdue = [_event(t, o) for t in overdue_one_off for o in recurrence.expand(t, datetime.min, today)]
    # Missed repeats from the last two weeks.
    overdue += [e for e in calendar(session, today - timedelta(days=14), today) if e.recurring and e.status in open_]

    upcoming = calendar(session, today, tomorrow + timedelta(days=days))
    return {
        "overdue": sorted(overdue, key=lambda e: e.start),
        "today": [e for e in upcoming if e.start < tomorrow],
        "upcoming": [e for e in upcoming if e.start >= tomorrow],
    }


def conflicts(
    session: Session, start: datetime, end: datetime, exclude_task_id: int | None = None
) -> list[CalendarEvent]:
    """Timed, open tasks overlapping [start, end)."""
    return [
        e
        for e in calendar(session, start - timedelta(days=1), end)
        if not e.all_day
        and e.task_id != exclude_task_id
        and e.status in OPEN_STATUSES
        and e.start < end
        and (e.end or e.start + timedelta(minutes=1)) > start
    ]
