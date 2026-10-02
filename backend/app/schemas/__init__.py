from datetime import datetime
from enum import Enum

from dateutil.rrule import rrulestr
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import Priority, TaskStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- categories & tags ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = Field(default=None, max_length=40)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = Field(default=None, max_length=40)


class CategoryOut(ORM):
    id: int
    name: str
    color: str
    icon: str | None


class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class TagOut(ORM):
    id: int
    name: str


# ---------- tasks ----------
class ChecklistItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    done: bool = False


class ChecklistItemOut(ORM):
    id: int
    text: str
    done: bool


class AttachmentBrief(ORM):
    id: int
    original_name: str
    mime: str
    size: int


def _validate_rrule(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip().removeprefix("RRULE:")
    try:
        rrulestr(value, dtstart=datetime(2000, 1, 1))
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid repeat rule: {exc}") from exc
    return value


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None
    all_day: bool = False
    priority: Priority = Priority.medium
    status: TaskStatus = TaskStatus.todo
    category_id: int | None = None
    tags: list[str] = []
    rrule: str | None = None
    rollover: bool = False
    location: str | None = Field(default=None, max_length=300)
    checklist: list[ChecklistItemIn] = []

    _rrule = field_validator("rrule")(_validate_rrule)

    @model_validator(mode="after")
    def _dates(self):
        if self.start_at and self.due_at and self.due_at < self.start_at:
            raise ValueError("End time must be after start time")
        if self.rrule and not (self.start_at or self.due_at):
            raise ValueError("A repeating task needs a date")
        return self


class TaskCreate(TaskBase):
    # None = use the default reminders for the task's priority.
    reminders: list[int] | None = None


class TaskUpdate(BaseModel):
    """Partial update: only fields that are sent are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None
    all_day: bool | None = None
    priority: Priority | None = None
    status: TaskStatus | None = None
    category_id: int | None = None
    tags: list[str] | None = None
    rrule: str | None = None
    rollover: bool | None = None
    location: str | None = Field(default=None, max_length=300)
    checklist: list[ChecklistItemIn] | None = None
    reminders: list[int] | None = None

    _rrule = field_validator("rrule")(_validate_rrule)


class TaskOut(ORM):
    id: int
    title: str
    description: str | None
    start_at: datetime | None
    due_at: datetime | None
    all_day: bool
    priority: Priority
    status: TaskStatus
    category_id: int | None
    category: CategoryOut | None
    tags: list[TagOut]
    rrule: str | None
    rollover: bool
    location: str | None
    source: str
    reminders: list[int]
    checklist: list[ChecklistItemOut]
    attachments: list[AttachmentBrief]
    created_at: datetime
    updated_at: datetime

    @field_validator("reminders", mode="before")
    @classmethod
    def _reminder_offsets(cls, v):
        return [r if isinstance(r, int) else r.offset_minutes for r in v]


class Scope(str, Enum):
    this = "this"
    following = "following"
    all = "all"


class OccurrenceStatusIn(BaseModel):
    occurrence: datetime | None = None
    status: TaskStatus = TaskStatus.done


# ---------- calendar ----------
class CalendarEvent(BaseModel):
    id: str
    task_id: int
    occurrence: datetime | None  # original start of a repeat; None for one-off tasks
    title: str
    start: datetime
    end: datetime | None
    all_day: bool
    status: TaskStatus
    priority: Priority
    color: str | None
    category_id: int | None
    recurring: bool
    has_attachments: bool


# ---------- attachments ----------
class AttachmentOut(ORM):
    id: int
    task_id: int | None
    original_name: str
    mime: str
    size: int
    note: str | None
    uploaded_at: datetime


class AttachmentUpdate(BaseModel):
    original_name: str | None = Field(default=None, min_length=1, max_length=255)
    note: str | None = None
    task_id: int | None = None


# ---------- settings ----------
class AppSettings(BaseModel):
    auto_priority_bump: bool = True
    # Minutes before the task, per priority.
    default_reminders: dict[Priority, list[int]] = {
        Priority.low: [],
        Priority.medium: [60],
        Priority.high: [24 * 60, 60],
        Priority.urgent: [24 * 60, 60, 15],
    }
