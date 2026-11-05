import hashlib
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from numpy.typing import NDArray
from rasterio.features import geometry_mask
from rasterio.warp import transform, transform_geom

ROOT = Path(__file__).resolve().parent.parent
PLOTS_FILE = ROOT / "fixtures" / "demo-plots.geojson"
DEFAULT_OUT = ROOT / "fixtures" / "data"

SEED = 20250101
CENTER_LON, CENTER_LAT = -44.55, -7.23
CRS = "EPSG:32723"
SIZE, RES = 1000, 10
N_SCENES, STEP_DAYS = 12, 15
BASE_DATE = date(2025, 1, 1)
DATES = [BASE_DATE + timedelta(days=STEP_DAYS * i) for i in range(N_SCENES)]

HEALTHY_NDVI, BACKGROUND_NDVI = 0.78, 0.5
# dois focos (metades do talhão, separadas por faixa sadia) que crescem até cobrir ~85%:
# média do talhão cai a ~0,12 (vermelho na rampa) e a maior mancha fica bem menor que o talhão
PATCH_RADII = [[0] * 6 + [7, 9, 16, 32, 56, 60], [0] * 8 + [12, 30, 56, 60]]
# a mancha aprofunda a cada data para seguir abaixo do p10 histórico (RN-09)
SICK_LEVELS = [0.0] * 6 + [0.25, 0.25, 0.2, 0.12, 0.07, 0.05]
HEALTHY_BAND = 3
CLOUDS = {3: (9, 150), 5: (9, 650), 7: (9, 470)}


def grid_transform() -> Affine:
    (x,), (y,) = transform("EPSG:4326", CRS, [CENTER_LON], [CENTER_LAT])
    return Affine(RES, 0, x - SIZE * RES / 2, 0, -RES, y + SIZE * RES / 2)


def load_plots() -> list[dict]:
    return json.loads(PLOTS_FILE.read_text())["features"]


def _scene_arrays(
    i: int,
    rng: np.random.Generator,
    plot_masks: list[tuple[bool, NDArray]],
    foci: list[tuple[NDArray, NDArray]],
) -> tuple[NDArray, NDArray, NDArray]:
    ndvi = np.full((SIZE, SIZE), BACKGROUND_NDVI)
    for _, m in plot_masks:
        ndvi[m] = HEALTHY_NDVI
    for (region, dist2), radii in zip(foci, PATCH_RADII, strict=True):
        ndvi[region & (dist2 <= radii[i] ** 2)] = SICK_LEVELS[i]
    ndvi = np.clip(ndvi + rng.normal(0, 0.02, ndvi.shape), -0.9, 0.95)
    b04 = 1000 + rng.integers(-100, 100, ndvi.shape)
    b08 = np.clip(np.rint(b04 * (1 + ndvi) / (1 - ndvi)), 0, 65535)
    scl = np.full(ndvi.shape, 4, dtype=np.uint16)
    if i in CLOUDS:
        scl[:, : CLOUDS[i][1]] = CLOUDS[i][0]
    return b04.astype(np.uint16), b08.astype(np.uint16), scl


def generate(out_dir: Path = DEFAULT_OUT) -> str:
    out_dir = Path(out_dir)
    tf = grid_transform()
    rng = np.random.default_rng(SEED)
    plots = load_plots()
    masks = []
    for f in plots:
        g = transform_geom("EPSG:4326", CRS, f["geometry"])
        masks.append(
            (
                bool(f["properties"].get("problematic")),
                geometry_mask([g], (SIZE, SIZE), tf, invert=True),
            )
        )
    sick = next(m for p, m in masks if p)
    rows, cols = np.nonzero(sick)
    cy, mid = int(rows.mean()), int(cols.mean())
    yy, xx = np.indices((SIZE, SIZE))
    foci = [
        (sick & (xx > mid + HEALTHY_BAND), (yy - cy) ** 2 + (xx - mid - 20) ** 2),
        (sick & (xx < mid - HEALTHY_BAND), (yy - cy) ** 2 + (xx - mid + 20) ** 2),
    ]

    digest = hashlib.sha256()
    for i, d in enumerate(DATES):
        scene_dir = out_dir / d.isoformat()
        scene_dir.mkdir(parents=True, exist_ok=True)
        for band, arr in zip(
            ("B04", "B08", "SCL"), _scene_arrays(i, rng, masks, foci), strict=True
        ):
            digest.update(arr.tobytes())
            with rasterio.open(
                scene_dir / f"{band}.tif",
                "w",
                driver="GTiff",
                height=SIZE,
                width=SIZE,
                count=1,
                dtype="uint16",
                crs=CRS,
                transform=tf,
                compress="deflate",
            ) as dst:
                dst.write(arr, 1)
    return digest.hexdigest()


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    print(generate(target))
