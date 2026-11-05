from datetime import date
from typing import Protocol

from app.pipeline import SceneFiles


class Source(Protocol):
    name: str

    def list_scenes(self, geom: dict, date_from: date, date_to: date) -> list[SceneFiles]: ...
