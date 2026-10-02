"""Expanding repeating tasks into concrete occurrences, and splitting a series."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from dateutil.rrule import rrule as RRule
from dateutil.rrule import rrulestr

from app.models import Task, TaskStatus


@dataclass(frozen=True)
class Occurrence:
    original: datetime | None  # original start of this repeat; None for one-off tasks
    start: datetime
    end: datetime | None
    status: TaskStatus


def build_rule(task: Task) -> RRule:
    return rrulestr(task.rrule, dtstart=task.anchor)


def duration(task: Task) -> timedelta | None:
    if task.start_at and task.due_at:
        return task.due_at - task.start_at
    return None


def _end_of(task: Task, start: datetime) -> datetime | None:
    dur = duration(task)
    return start + dur if dur is not None else None


def expand(task: Task, frm: datetime, to: datetime) -> list[Occurrence]:
    """All occurrences of `task` overlapping [frm, to)."""
    anchor = task.anchor
    if anchor is None:
        return []
    if not task.rrule:
        end = _end_of(task, anchor)
        if anchor < to and (end or anchor) >= frm:
            return [Occurrence(None, anchor, end, task.status)]
        return []

    overrides = {o.original_start: o for o in task.occurrences}
    dur = duration(task) or timedelta(0)
    originals = set(build_rule(task).between(frm - dur, to, inc=True))
    # Occurrences moved into this range from outside it.
    originals |= {o for o, ov in overrides.items() if ov.new_start and frm <= ov.new_start < to}

    result = []
    for original in sorted(originals):
        ov = overrides.get(original)
        if ov and ov.deleted:
            continue
        start = (ov.new_start if ov else None) or original
        end = (ov.new_due if ov else None) or _end_of(task, start)
        if start >= to or (end or start) < frm:
            continue
        status = (ov.status if ov else None) or task.status
        result.append(Occurrence(original, start, end, status))
    return result


def is_occurrence(task: Task, when: datetime) -> bool:
    rule = build_rule(task)
    return rule.after(when, inc=True) == when


def rule_parts(rule_str: str) -> dict[str, str]:
    return dict(part.split("=", 1) for part in rule_str.split(";") if "=" in part)


def join_parts(parts: dict[str, str]) -> str:
    return ";".join(f"{k}={v}" for k, v in parts.items())


def truncate_before(task: Task, when: datetime) -> str | None:
    """Rule for the same series ending just before `when`. None if nothing would remain."""
    prev = build_rule(task).before(when)
    if prev is None:
        return None
    parts = rule_parts(task.rrule)
    parts.pop("COUNT", None)
    parts["UNTIL"] = prev.strftime("%Y%m%dT%H%M%S")
    return join_parts(parts)


def remainder_from(task: Task, when: datetime) -> str:
    """Rule for a new series starting at `when` that continues the old one."""
    parts = rule_parts(task.rrule)
    if "COUNT" in parts:
        before = len(build_rule(task).between(task.anchor - timedelta(seconds=1), when))
        parts["COUNT"] = str(max(int(parts["COUNT"]) - before, 1))
    return join_parts(parts)
