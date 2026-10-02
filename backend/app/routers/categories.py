from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_session
from app.errors import BadRequest, NotFound
from app.models import Category, Tag
from app.schemas import CategoryIn, CategoryOut, CategoryUpdate, TagIn, TagOut

router = APIRouter(prefix="/api", tags=["categories"])


def _commit_unique(session: Session, what: str) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise BadRequest(f"A {what} with this name already exists") from exc


def _get(session: Session, model, item_id: int, what: str):
    item = session.get(model, item_id)
    if item is None:
        raise NotFound(what)
    return item


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(session: Session = Depends(get_session)):
    return session.scalars(select(Category).order_by(Category.name)).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryIn, session: Session = Depends(get_session)):
    category = Category(**payload.model_dump())
    session.add(category)
    _commit_unique(session, "category")
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, session: Session = Depends(get_session)):
    category = _get(session, Category, category_id, "Category")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    _commit_unique(session, "category")
    return category


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, session: Session = Depends(get_session)):
    session.delete(_get(session, Category, category_id, "Category"))
    session.commit()
    return Response(status_code=204)


@router.get("/tags", response_model=list[TagOut])
def list_tags(session: Session = Depends(get_session)):
    return session.scalars(select(Tag).order_by(Tag.name)).all()


@router.post("/tags", response_model=TagOut, status_code=201)
def create_tag(payload: TagIn, session: Session = Depends(get_session)):
    tag = Tag(name=payload.name.strip())
    session.add(tag)
    _commit_unique(session, "tag")
    return tag


@router.patch("/tags/{tag_id}", response_model=TagOut)
def rename_tag(tag_id: int, payload: TagIn, session: Session = Depends(get_session)):
    tag = _get(session, Tag, tag_id, "Tag")
    tag.name = payload.name.strip()
    _commit_unique(session, "tag")
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, session: Session = Depends(get_session)):
    session.delete(_get(session, Tag, tag_id, "Tag"))
    session.commit()
    return Response(status_code=204)
