from datetime import datetime

WEEK = {"start": "2026-10-05T00:00:00", "end": "2026-10-12T00:00:00"}


def make(client, **kw):
    body = {"title": "משימה", **kw}
    r = client.post("/api/tasks", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def events(client, **range_):
    r = client.get("/api/calendar", params=range_ or WEEK)
    assert r.status_code == 200, r.text
    return r.json()


def test_crud_roundtrip(client):
    cat = client.post("/api/categories", json={"name": "בית", "color": "#ff0000"}).json()
    t = make(client, start_at="2026-10-06T09:00:00", due_at="2026-10-06T10:00:00", category_id=cat["id"],
             tags=["חשבונות", "בית"], checklist=[{"text": "a"}, {"text": "b", "done": True}], reminders=[30])
    assert [x["name"] for x in t["tags"]] == ["חשבונות", "בית"]
    assert t["reminders"] == [30] and len(t["checklist"]) == 2

    r = client.patch(f"/api/tasks/{t['id']}", json={"title": "עודכן", "tags": ["בית"], "category_id": None})
    assert r.json()["title"] == "עודכן" and r.json()["category"] is None and len(r.json()["tags"]) == 1

    assert client.get("/api/tasks", params={"q": "עודכן"}).json()["total"] == 1
    assert client.delete(f"/api/tasks/{t['id']}").status_code == 204
    assert client.get(f"/api/tasks/{t['id']}").status_code == 404


def test_validation(client):
    assert client.post("/api/tasks", json={"title": ""}).status_code == 422
    bad_dates = {"title": "x", "start_at": "2026-10-06T10:00:00", "due_at": "2026-10-06T09:00:00"}
    assert client.post("/api/tasks", json=bad_dates).status_code == 422
    assert client.post("/api/tasks", json={"title": "x", "rrule": "FREQ=NOPE"}).status_code == 422
    assert client.post("/api/tasks", json={"title": "x", "rrule": "FREQ=DAILY"}).status_code == 422  # no date
    assert client.post("/api/tasks", json={"title": "x", "category_id": 999}).status_code == 400


def test_default_reminders_by_priority(client):
    assert make(client, priority="urgent")["reminders"] == [15, 60, 1440]
    assert make(client, priority="low")["reminders"] == []
    assert make(client, priority="urgent", reminders=[5])["reminders"] == [5]


def test_weekly_recurrence(client):
    make(client, start_at="2026-10-05T08:00:00", due_at="2026-10-05T08:30:00", rrule="FREQ=WEEKLY;BYDAY=MO,WE")
    evs = events(client)
    assert [e["start"] for e in evs] == ["2026-10-05T08:00:00", "2026-10-07T08:00:00"]
    assert evs[0]["end"] == "2026-10-05T08:30:00" and evs[0]["recurring"]


def test_monthly_last_friday_and_count(client):
    make(client, start_at="2026-10-30T12:00:00", rrule="FREQ=MONTHLY;BYDAY=-1FR;COUNT=3")
    evs = events(client, start="2026-10-01T00:00:00", end="2027-03-01T00:00:00")
    assert [e["start"][:10] for e in evs] == ["2026-10-30", "2026-11-27", "2026-12-25"]


def test_edit_this_occurrence_move_and_detach(client):
    t = make(client, start_at="2026-10-05T08:00:00", rrule="FREQ=DAILY;COUNT=5")
    occ = "2026-10-06T08:00:00"
    # Moving one occurrence records an override.
    r = client.patch(f"/api/tasks/{t['id']}", params={"scope": "this", "occurrence": occ},
                     json={"start_at": "2026-10-06T15:00:00"})
    assert r.json()["id"] == t["id"]
    starts = [e["start"] for e in events(client)]
    assert "2026-10-06T15:00:00" in starts and occ not in starts and len(starts) == 5

    # Renaming one occurrence detaches it into its own task.
    occ2 = "2026-10-07T08:00:00"
    r = client.patch(f"/api/tasks/{t['id']}", params={"scope": "this", "occurrence": occ2}, json={"title": "שונה"})
    new = r.json()
    assert new["id"] != t["id"] and new["rrule"] is None and new["start_at"] == occ2
    titles = {e["start"]: e["title"] for e in events(client)}
    assert titles[occ2] == "שונה" and len(titles) == 5


def test_edit_following_splits_series(client):
    t = make(client, start_at="2026-10-05T08:00:00", rrule="FREQ=DAILY;COUNT=6")
    r = client.patch(f"/api/tasks/{t['id']}", params={"scope": "following", "occurrence": "2026-10-08T08:00:00"},
                     json={"title": "חדש"})
    new = r.json()
    assert "COUNT=3" in new["rrule"]
    evs = events(client)
    assert [e["title"] for e in evs] == ["משימה"] * 3 + ["חדש"] * 3
    assert "UNTIL=20261007T080000" in client.get(f"/api/tasks/{t['id']}").json()["rrule"]


def test_edit_all_changes_series(client):
    t = make(client, start_at="2026-10-05T08:00:00", rrule="FREQ=DAILY;COUNT=3")
    client.patch(f"/api/tasks/{t['id']}", params={"scope": "all"}, json={"rrule": "FREQ=DAILY;COUNT=2"})
    assert len(events(client)) == 2


def test_delete_scopes(client):
    t = make(client, start_at="2026-10-05T08:00:00", rrule="FREQ=DAILY")
    tid = t["id"]
    assert client.delete(f"/api/tasks/{tid}", params={"scope": "this", "occurrence": "2026-10-06T08:00:00"}).status_code == 204
    assert "2026-10-06T08:00:00" not in [e["start"] for e in events(client)]
    client.delete(f"/api/tasks/{tid}", params={"scope": "following", "occurrence": "2026-10-09T08:00:00"})
    assert [e["start"][:10] for e in events(client)] == ["2026-10-05", "2026-10-07", "2026-10-08"]
    # "following" from the first occurrence removes the whole task.
    client.delete(f"/api/tasks/{tid}", params={"scope": "following", "occurrence": "2026-10-05T08:00:00"})
    assert client.get(f"/api/tasks/{tid}").status_code == 404


def test_bad_occurrence_rejected(client):
    t = make(client, start_at="2026-10-05T08:00:00", rrule="FREQ=DAILY")
    r = client.delete(f"/api/tasks/{t['id']}", params={"scope": "this", "occurrence": "2026-10-05T09:00:00"})
    assert r.status_code == 400


def test_complete_occurrence(client):
    t = make(client, start_at="2026-10-05T08:00:00", rrule="FREQ=DAILY;COUNT=2")
    client.post(f"/api/tasks/{t['id']}/status", json={"occurrence": "2026-10-05T08:00:00", "status": "done"})
    assert [e["status"] for e in events(client)] == ["done", "todo"]
    one = make(client, start_at="2026-10-06T08:00:00")
    assert client.post(f"/api/tasks/{one['id']}/status", json={"status": "done"}).json()["status"] == "done"


def test_conflicts(client):
    a = make(client, start_at="2026-10-06T09:00:00", due_at="2026-10-06T10:00:00")
    make(client, start_at="2026-10-06T11:00:00", due_at="2026-10-06T12:00:00")
    hits = client.get("/api/calendar/conflicts",
                      params={"start": "2026-10-06T09:30:00", "end": "2026-10-06T10:30:00"}).json()
    assert [h["task_id"] for h in hits] == [a["id"]]
    none = client.get("/api/calendar/conflicts", params={"start": "2026-10-06T09:30:00", "end": "2026-10-06T10:30:00",
                                                         "exclude_task_id": a["id"]}).json()
    assert none == []


def test_agenda(client):
    now = datetime.now().replace(microsecond=0)
    make(client, title="ישן", start_at="2020-01-01T09:00:00")
    make(client, title="היום", start_at=now.replace(hour=23, minute=59).isoformat())
    data = client.get("/api/agenda").json()
    assert [e["title"] for e in data["overdue"]] == ["ישן"]
    assert [e["title"] for e in data["today"]] == ["היום"]


def test_categories_and_tags_crud(client):
    c = client.post("/api/categories", json={"name": "עבודה"}).json()
    assert client.post("/api/categories", json={"name": "עבודה"}).status_code == 400
    assert client.patch(f"/api/categories/{c['id']}", json={"color": "#00ff00"}).json()["color"] == "#00ff00"
    t = make(client, category_id=c["id"])
    assert client.delete(f"/api/categories/{c['id']}").status_code == 204
    assert client.get(f"/api/tasks/{t['id']}").json()["category_id"] is None

    tag = client.post("/api/tags", json={"name": "x"}).json()
    assert client.patch(f"/api/tags/{tag['id']}", json={"name": "y"}).json()["name"] == "y"
    assert client.delete(f"/api/tags/{tag['id']}").status_code == 204


def test_due_only_edits(client):
    t = make(client, due_at="2026-10-06T17:00:00")
    r = client.patch(f"/api/tasks/{t['id']}", json={"due_at": "2026-10-08T12:00:00"})
    assert r.status_code == 200 and r.json()["start_at"] is None and r.json()["due_at"] == "2026-10-08T12:00:00"

    # Moving one repeat of a due-only series by its due date moves that repeat.
    s = make(client, due_at="2026-10-05T17:00:00", rrule="FREQ=DAILY;COUNT=3")
    r = client.patch(f"/api/tasks/{s['id']}", params={"scope": "this", "occurrence": "2026-10-06T17:00:00"},
                     json={"due_at": "2026-10-09T10:00:00"})
    assert r.status_code == 200
    starts = [e["start"] for e in events(client) if e["task_id"] == s["id"]]
    assert starts == ["2026-10-05T17:00:00", "2026-10-07T17:00:00", "2026-10-09T10:00:00"]
