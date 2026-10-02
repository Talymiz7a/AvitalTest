from sqlalchemy.orm import Session

from app.models import Setting
from app.schemas import AppSettings

KEY = "app"


def get_settings(session: Session) -> AppSettings:
    row = session.get(Setting, KEY)
    return AppSettings.model_validate(row.value) if row else AppSettings()


def save_settings(session: Session, data: AppSettings) -> AppSettings:
    row = session.get(Setting, KEY) or Setting(key=KEY)
    row.value = data.model_dump(mode="json")
    session.add(row)
    session.commit()
    return data
