"""Export everything to an Apple Numbers file (one sheet per kind of data)."""

from pathlib import Path

from numbers_parser import Document
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Attachment, Category, Task

PRIORITY_HE = {"low": "נמוכה", "medium": "בינונית", "high": "גבוהה", "urgent": "דחופה"}
STATUS_HE = {"todo": "לביצוע", "in_progress": "בתהליך", "done": "בוצע", "cancelled": "בוטל"}


def _rows(session: Session) -> dict[str, list[list]]:
    tasks = session.scalars(select(Task).order_by(Task.id)).unique().all()
    categories = session.scalars(select(Category).order_by(Category.name)).all()
    files = session.scalars(select(Attachment).order_by(Attachment.id)).all()
    return {
        "משימות": [
            ["מזהה", "כותרת", "תיאור", "התחלה", "סיום", "כל היום", "עדיפות", "סטטוס", "קטגוריה",
             "תגיות", "חזרה", "מיקום", "תזכורות (דקות)", "צ'קליסט", "נוצר"],
            *[
                [t.id, t.title, t.description, t.start_at, t.due_at, t.all_day, PRIORITY_HE[t.priority.value],
                 STATUS_HE[t.status.value], t.category.name if t.category else None,
                 ", ".join(x.name for x in t.tags), t.rrule, t.location,
                 ", ".join(str(r.offset_minutes) for r in t.reminders),
                 "\n".join(("✓ " if c.done else "☐ ") + c.text for c in t.checklist), t.created_at]
                for t in tasks
            ],
        ],
        "קטגוריות": [["מזהה", "שם", "צבע"], *[[c.id, c.name, c.color] for c in categories]],
        "קבצים": [
            ["מזהה", "שם קובץ", "סוג", "גודל (KB)", "משימה", "הערה", "הועלה"],
            *[[f.id, f.original_name, f.mime, round(f.size / 1024, 1), f.task_id, f.note, f.uploaded_at] for f in files],
        ],
    }


def export(session: Session, dest: Path) -> Path:
    doc = None
    for name, rows in _rows(session).items():
        size = {"num_rows": max(len(rows), 2), "num_cols": len(rows[0]), "num_header_cols": 0}
        if doc is None:
            doc = Document(sheet_name=name, table_name=name, **size)
        else:
            doc.add_sheet(name, name, num_rows=size["num_rows"], num_cols=size["num_cols"])
        table = doc.sheets[name].tables[0]
        for r, row in enumerate(rows):
            for c, value in enumerate(row):
                if value is not None and value != "":
                    table.write(r, c, value)
    doc.save(dest)
    return dest
