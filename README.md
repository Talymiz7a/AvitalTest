# המשימות שלי – Smart To-Do

A personal to-do app built around a calendar. Hebrew (RTL) interface. Runs locally on your Mac.

- **frontend/**: React + TypeScript (Vite), FullCalendar, TanStack Query, Framer Motion, Tailwind
- **backend/**: Python 3.12 + FastAPI, SQLite (via SQLAlchemy + Alembic), APScheduler
- **data/**: your database and uploaded files (created on first run; not in git)

## Run

```bash
./dev.sh
```
Opens http://localhost:5173. The backend runs on http://127.0.0.1:8000 (API docs at `/docs`).

First-time setup: install [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`) and Node.js.

## Tests

```bash
cd backend && uv run pytest
cd frontend && npm test
```

## Notes
- Times are stored as local time (no timezone): it's a single-user app.
- Repeating tasks use iCalendar RRULEs. Edit or delete one repeat, "this and following", or all of them.
- To move to Postgres later, set `SMARTTODO_DATABASE_URL` (see `backend/app/config.py`).
- Integrations (Gmail first) plug in via `backend/app/integrations/base.py`.
