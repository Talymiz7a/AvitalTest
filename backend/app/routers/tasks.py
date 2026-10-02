from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Priority, TaskStatus
from app.schemas import CalendarEvent, OccurrenceStatusIn, Scope, TaskCreate, TaskOut, TaskUpdate
from app.services import tasks as svc

router = APIRouter(prefix="/api", tags=["tasks"])


class TaskPage(BaseModel):
    items: list[TaskOut]
    total: int


@router.get("/tasks", response_model=TaskPage)
def list_tasks(
    q: str | None = None,
    status: list[TaskStatus] = Query(default=[]),
    priority: list[Priority] = Query(default=[]),
    category_id: int | None = None,
    tag: str | None = None,
    has_attachments: bool | None = None,
    sort: str = "anchor",
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    session: Session = Depends(get_session),
):
    items, total = svc.list_tasks(
        session, q=q, status=status, priority=priority, category_id=category_id, tag=tag,
        has_attachments=has_attachments, sort=sort, limit=limit, offset=offset,
    )
    return TaskPage(items=items, total=total)


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, session: Session = Depends(get_session)):
    return svc.create_task(session, payload)


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, session: Session = Depends(get_session)):
    return svc.get_task(session, task_id)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    scope: Scope = Scope.all,
    occurrence: datetime | None = None,
    session: Session = Depends(get_session),
):
    return svc.update_task(session, task_id, payload, scope, occurrence)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int, scope: Scope = Scope.all, occurrence: datetime | None = None, session: Session = Depends(get_session)
):
    svc.delete_task(session, task_id, scope, occurrence)
    return Response(status_code=204)


@router.post("/tasks/{task_id}/status", response_model=TaskOut)
def set_status(task_id: int, payload: OccurrenceStatusIn, session: Session = Depends(get_session)):
    return svc.set_status(session, task_id, payload.status, payload.occurrence)


@router.get("/calendar", response_model=list[CalendarEvent])
def calendar(start: datetime, end: datetime, session: Session = Depends(get_session)):
    return svc.calendar(session, start, end)


@router.get("/calendar/conflicts", response_model=list[CalendarEvent])
def conflicts(
    start: datetime, end: datetime, exclude_task_id: int | None = None, session: Session = Depends(get_session)
):
    return svc.conflicts(session, start, end, exclude_task_id)


@router.get("/agenda", response_model=dict[str, list[CalendarEvent]])
def agenda(days: int = Query(default=7, ge=1, le=60), session: Session = Depends(get_session)):
    return svc.agenda(session, datetime.now(), days)
