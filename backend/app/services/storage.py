"""Uploaded files live on disk in data/uploads; the database keeps only their details."""

import hashlib
import mimetypes
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import BadRequest, NotFound
from app.models import Attachment, Task

CHUNK = 1024 * 1024
ALLOWED_EXTENSIONS = {
    # documents
    ".pdf", ".txt", ".md", ".rtf", ".csv", ".json", ".eml",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods",
    ".pages", ".numbers", ".key",
    # images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic",
    # media & archives
    ".mp3", ".m4a", ".wav", ".mp4", ".mov", ".zip",
}
# Types the browser may show inline (preview). Everything else is always downloaded.
INLINE_PREFIXES = ("image/", "application/pdf", "text/plain", "audio/", "video/")


def path_for(attachment: Attachment) -> Path:
    return settings.uploads_dir / attachment.stored_name


def can_inline(attachment: Attachment) -> bool:
    return attachment.mime.startswith(INLINE_PREFIXES)


async def save_upload(session: Session, upload: UploadFile, task_id: int | None, note: str | None) -> Attachment:
    name = Path(upload.filename or "file").name[:255]
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequest(f"File type {ext or '(none)'} is not allowed")
    if task_id is not None and session.get(Task, task_id) is None:
        raise BadRequest("Task does not exist")

    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = settings.uploads_dir / stored_name
    limit = settings.max_upload_mb * 1024 * 1024
    digest, size = hashlib.sha256(), 0
    try:
        with dest.open("wb") as out:
            while chunk := await upload.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    raise BadRequest(f"File is larger than {settings.max_upload_mb}MB")
                digest.update(chunk)
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise

    attachment = Attachment(
        task_id=task_id,
        original_name=name,
        stored_name=stored_name,
        mime=mimetypes.guess_type(name)[0] or "application/octet-stream",
        size=size,
        sha256=digest.hexdigest(),
        note=note,
    )
    session.add(attachment)
    session.commit()
    return attachment


def get_attachment(session: Session, attachment_id: int) -> Attachment:
    attachment = session.get(Attachment, attachment_id)
    if attachment is None:
        raise NotFound("File")
    return attachment


def delete_attachment(session: Session, attachment_id: int) -> None:
    attachment = get_attachment(session, attachment_id)
    session.delete(attachment)
    session.commit()
    path_for(attachment).unlink(missing_ok=True)
