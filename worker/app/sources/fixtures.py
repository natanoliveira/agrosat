from datetime import date
from pathlib import Path

import rasterio
from rasterio.warp import transform_bounds
from shapely.geometry import box, shape

from app.errors import WorkerError
from app.pipeline import SceneFiles


class FixturesSource:
    name = "fixtures"

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)

    def _bbox(self, first: Path) -> tuple[float, float, float, float]:
        with rasterio.open(first) as ds:
            return transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)

    def list_scenes(self, geom: dict, date_from: date, date_to: date) -> list[SceneFiles]:
        # P1: a janela é ignorada, devolve sempre todas as datas das fixtures
        dirs = sorted(d for d in self.data_dir.glob("*") if (d / "B04.tif").exists())
        if not dirs or not box(*self._bbox(dirs[0] / "B04.tif")).contains(shape(geom)):
            raise WorkerError(
                "NO_OFFLINE_DATA",
                "Sem dados offline para esta área (fora da região de demonstração).",
                422,
            )
        return [SceneFiles(d.name, d / "B04.tif", d / "B08.tif", d / "SCL.tif") for d in dirs]
