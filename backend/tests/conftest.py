import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import Base, get_session, make_engine
from app.main import app


@pytest.fixture
def session_factory(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def session(session_factory):
    with session_factory() as s:
        yield s


@pytest.fixture
def client(session_factory):
    def _session():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    yield TestClient(app)  # not used as a context manager, so no scheduler/migrations
    app.dependency_overrides.clear()
