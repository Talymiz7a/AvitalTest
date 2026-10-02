from datetime import datetime, timedelta

from numbers_parser import Document

from app.config import settings
from app.models import Priority, Task
from app.services import rules
from app.services.reminders import due_reminders


def test_upload_download_rename_delete(client):
    task = client.post("/api/tasks", json={"title": "חשבון"}).json()
    r = client.post("/api/attachments", data={"task_id": str(task["id"]), "note": "חשמל"},
                    files=[("files", ("חשבון.pdf", b"%PDF-1.4 hello", "application/pdf"))])
    assert r.status_code == 201, r.text
    att = r.json()[0]
    assert att["size"] == 14 and att["mime"] == "application/pdf"
    stored = list(settings.uploads_dir.iterdir())
    assert len(stored) == 1

    assert client.get(f"/api/tasks/{task['id']}").json()["attachments"][0]["id"] == att["id"]
    dl = client.get(f"/api/attachments/{att['id']}/download")
    assert dl.content == b"%PDF-1.4 hello" and dl.headers["content-disposition"].startswith("attachment")
    assert client.get(f"/api/attachments/{att['id']}/download", params={"inline": 1}).headers[
        "content-disposition"].startswith("inline")

    r = client.patch(f"/api/attachments/{att['id']}", json={"original_name": "new.pdf", "task_id": None})
    assert r.json()["original_name"] == "new.pdf" and r.json()["task_id"] is None
    assert len(client.get("/api/attachments", params={"unlinked": True}).json()) == 1

    assert client.delete(f"/api/attachments/{att['id']}").status_code == 204
    assert not stored[0].exists()
    assert client.get(f"/api/attachments/{att['id']}/download").status_code == 404


def test_upload_rejects_bad_type_and_size(client, monkeypatch):
    r = client.post("/api/attachments", files=[("files", ("x.exe", b"MZ", "application/octet-stream"))])
    assert r.status_code == 400
    monkeypatch.setattr(settings, "max_upload_mb", 0)
    r = client.post("/api/attachments", files=[("files", ("x.txt", b"too big", "text/plain"))])
    assert r.status_code == 400
    assert list(settings.uploads_dir.iterdir()) == []


def test_deleting_task_keeps_file(client):
    task = client.post("/api/tasks", json={"title": "x"}).json()
    att = client.post("/api/attachments", data={"task_id": str(task["id"])},
                      files=[("files", ("a.txt", b"hi", "text/plain"))]).json()[0]
    client.delete(f"/api/tasks/{task['id']}")
    assert client.get("/api/attachments").json()[0]["id"] == att["id"]


def test_rollover(session):
    now = datetime(2026, 10, 10, 7, 0)
    roll = Task(title="a", start_at=datetime(2026, 10, 7, 9), due_at=datetime(2026, 10, 7, 10), rollover=True)
    stay = Task(title="b", start_at=datetime(2026, 10, 7, 9))
    session.add_all([roll, stay])
    session.commit()
    assert rules.rollover_overdue(session, now) == 1
    assert roll.start_at == datetime(2026, 10, 10, 9) and roll.due_at == datetime(2026, 10, 10, 10)
    assert stay.start_at == datetime(2026, 10, 7, 9)


def test_priority_bump_once(session):
    now = datetime(2026, 10, 10, 7, 0)
    soon = Task(title="a", due_at=now + timedelta(hours=5), priority=Priority.medium)
    later = Task(title="b", due_at=now + timedelta(days=3), priority=Priority.medium)
    session.add_all([soon, later])
    session.commit()
    assert rules.bump_priorities(session, now) == 1
    assert soon.priority == Priority.high and later.priority == Priority.medium
    assert rules.bump_priorities(session, now) == 0  # never bumps the same task twice


def test_reminders_fire_once(client, session_factory):
    t = client.post("/api/tasks", json={"title": "r", "start_at": "2026-10-06T10:00:00",
                                        "rrule": "FREQ=DAILY", "reminders": [15]}).json()
    with session_factory() as s:
        fired = due_reminders(s, datetime(2026, 10, 6, 9, 40), datetime(2026, 10, 6, 9, 46))
        assert [(f["task_id"], f["start"]) for f in fired] == [(t["id"], "2026-10-06T10:00:00")]
        assert due_reminders(s, datetime(2026, 10, 6, 9, 40), datetime(2026, 10, 6, 9, 46)) == []
        # Next day's occurrence fires on its own.
        assert len(due_reminders(s, datetime(2026, 10, 7, 9, 44), datetime(2026, 10, 7, 9, 45))) == 1
    client.post(f"/api/tasks/{t['id']}/status", json={"occurrence": "2026-10-08T10:00:00", "status": "done"})
    with session_factory() as s:
        assert due_reminders(s, datetime(2026, 10, 8, 9, 44), datetime(2026, 10, 8, 9, 46)) == []


def test_export_numbers(client, tmp_path):
    client.post("/api/categories", json={"name": "בית"})
    client.post("/api/tasks", json={"title": "לשלם חשמל", "start_at": "2026-10-06T10:00:00", "tags": ["כסף"]})
    r = client.get("/api/export/numbers")
    assert r.status_code == 200
    out = tmp_path / "out.numbers"
    out.write_bytes(r.content)
    doc = Document(out)
    rows = doc.sheets["משימות"].tables[0].rows(values_only=True)
    assert rows[1][1] == "לשלם חשמל" and rows[1][9] == "כסף"
    assert doc.sheets["קטגוריות"].tables[0].rows(values_only=True)[1][1] == "בית"


def test_settings_roundtrip(client):
    s = client.get("/api/settings").json()
    s["auto_priority_bump"] = False
    assert client.put("/api/settings", json=s).json()["auto_priority_bump"] is False
    assert client.get("/api/settings").json()["auto_priority_bump"] is False
