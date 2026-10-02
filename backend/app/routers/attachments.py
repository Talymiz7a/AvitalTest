from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import BadRequest
from app.models import Attachment, Task
from app.schemas import AttachmentOut, AttachmentUpdate
from app.services import storage

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


@router.get("", response_model=list[AttachmentOut])
def list_attachments(
    task_id: int | None = None,
    unlinked: bool = False,
    q: str | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(Attachment).order_by(Attachment.uploaded_at.desc(), Attachment.id.desc())
    if task_id is not None:
        stmt = stmt.where(Attachment.task_id == task_id)
    if unlinked:
        stmt = stmt.where(Attachment.task_id.is_(None))
    if q:
        stmt = stmt.where(Attachment.original_name.ilike(f"%{q}%") | Attachment.note.ilike(f"%{q}%"))
    return session.scalars(stmt).all()


@router.post("", response_model=list[AttachmentOut], status_code=201)
async def upload(
    files: list[UploadFile] = File(...),
    task_id: int | None = Form(default=None),
    note: str | None = Form(default=None),
    session: Session = Depends(get_session),
):
    return [await storage.save_upload(session, f, task_id, note) for f in files]


@router.get("/{attachment_id}/download")
def download(attachment_id: int, inline: bool = Query(default=False), session: Session = Depends(get_session)):
    attachment = storage.get_attachment(session, attachment_id)
    disposition = "inline" if inline and storage.can_inline(attachment) else "attachment"
    return FileResponse(
        storage.path_for(attachment),
        media_type=attachment.mime,
        filename=attachment.original_name,
        content_disposition_type=disposition,
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.patch("/{attachment_id}", response_model=AttachmentOut)
def update_attachment(attachment_id: int, payload: AttachmentUpdate, session: Session = Depends(get_session)):
    attachment = storage.get_attachment(session, attachment_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("task_id") is not None and session.get(Task, data["task_id"]) is None:
        raise BadRequest("Task does not exist")
    for key, value in data.items():
        setattr(attachment, key, value)
    session.commit()
    return attachment


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, session: Session = Depends(get_session)):
    storage.delete_attachment(session, attachment_id)
    return Response(status_code=204)
