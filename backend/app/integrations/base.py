"""Extension point for external sources (Gmail first).

An integration turns items from an outside service into tasks. Tasks it creates carry
`source` (e.g. "gmail") and `external_ref` (e.g. the Gmail message id), so syncing again
updates the same task instead of creating duplicates.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ExternalItem:
    external_ref: str
    title: str
    description: str | None = None
    due_at: datetime | None = None
    tags: list[str] = field(default_factory=list)


class Integration(ABC):
    source: str

    @abstractmethod
    def fetch(self) -> list[ExternalItem]:
        """Return items that should exist as tasks."""
