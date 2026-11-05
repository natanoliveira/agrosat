import logging
import os
from datetime import date
from pathlib import Path

from app.errors import WorkerError
from app.pipeline import SceneFiles
from app.sources.fixtures import FixturesSource
from app.sources.stac import StacSource

log = logging.getLogger("agrosat.sources")


def data_mode() -> str:
    return os.environ.get("DATA_MODE", "auto")


def _fixtures() -> FixturesSource:
    return FixturesSource(Path(os.environ.get("FIXTURES_DIR", "fixtures")) / "data")


def _stac() -> StacSource:
    return StacSource(
        os.environ.get("STAC_URL", "https://earth-search.aws.element84.com/v1"),
        os.environ.get("STAC_COLLECTION", "sentinel-2-l2a"),
        float(os.environ.get("STAC_TIMEOUT_S", "10")),
    )


def list_scenes(geom: dict, date_from: date, date_to: date) -> tuple[str, list[SceneFiles]]:
    """Retorna (source, cenas) conforme DATA_MODE (RN-13)."""
    mode = data_mode()
    if mode == "fixtures":
        src: FixturesSource | StacSource = _fixtures()
    elif mode == "stac":
        src = _stac()
    else:
        try:
            return "stac", _stac().list_scenes(geom, date_from, date_to)
        except WorkerError as e:
            if e.code != "STAC_UNAVAILABLE":
                raise
            log.warning("STAC indisponível, usando fixtures (DATA_MODE=auto)")
        src = _fixtures()
    return src.name, src.list_scenes(geom, date_from, date_to)
