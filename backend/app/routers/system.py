import asyncio
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas import AppSettings
from app.services import export_numbers
from app.services.reminders import broadcaster
from app.services.settings import get_settings, save_settings

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/settings", response_model=AppSettings)
def read_settings(session: Session = Depends(get_session)):
    return get_settings(session)


@router.put("/settings", response_model=AppSettings)
def write_settings(payload: AppSettings, session: Session = Depends(get_session)):
    return save_settings(session, payload)


@router.get("/export/numbers")
def export_to_numbers(background: BackgroundTasks, session: Session = Depends(get_session)):
    fd, name = tempfile.mkstemp(suffix=".numbers")
    os.close(fd)
    tmp = Path(name)
    export_numbers.export(session, tmp)
    background.add_task(tmp.unlink, missing_ok=True)
    name = f"smart-todo-{datetime.now():%Y-%m-%d}.numbers"
    return FileResponse(tmp, media_type="application/x-iwork-numbers-sffnumbers", filename=name)


@router.get("/events")
async def events(request: Request):
    """Server-Sent Events stream: reminders are pushed here as they become due."""
    queue = broadcaster.subscribe()

    async def stream():
        try:
            yield "retry: 5000\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.get("/health")
def health():
    return {"ok": True}
