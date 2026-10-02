from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    """App settings. Override any value with an env var prefixed SMARTTODO_ (or backend/.env)."""

    model_config = SettingsConfigDict(env_prefix="SMARTTODO_", env_file=BASE_DIR / ".env")

    data_dir: Path = ROOT_DIR / "data"
    # Swap to e.g. postgresql+psycopg://... to move off SQLite; nothing else changes.
    database_url: str = ""
    max_upload_mb: int = 50
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    run_scheduler: bool = True

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def db_url(self) -> str:
        return self.database_url or f"sqlite:///{self.data_dir / 'smart_todo.db'}"


settings = Settings()
