from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from affine import Affine
from numpy.typing import NDArray
from rasterio.mask import mask as rio_mask
from rasterio.warp import transform_geom

from app.alerts import drop_alert, historical_p10, patch_alert
from app.mask import apply_mask, inside_mask
from app.ndvi import ndvi as compute_ndvi
from app.render import lonlat_bounds, render_png
from app.stats import Stats, scene_stats
from app.zones import make_zones


@dataclass(frozen=True)
class SceneFiles:
    date: str
    b04: Path | str
    b08: Path | str
    scl: Path | str


@dataclass
class SceneResult:
    date: str
    valid: bool
    stats: Stats | None = None
    png: bytes | None = None
    bounds: list[list[float]] | None = None
    zones: list[dict[str, Any]] = field(default_factory=list)
    valid_pct: float = 0.0
    raster: tuple[NDArray, Affine, Any] | None = field(default=None, compare=False, repr=False)


@dataclass
class PlotResult:
    scenes: list[SceneResult]
    alerts: list[dict[str, Any]]


# COG remoto: evita listar o diretório a cada open, limita espera e reaproveita conexão
_READ_THREADS = 6
_GDAL_HTTP = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
    "GDAL_HTTP_TIMEOUT": "20",
    "GDAL_HTTP_MAX_RETRY": "2",
    "GDAL_HTTP_MULTIPLEX": "YES",
    "VSI_CACHE": "TRUE",
}


def _read_clip(path: Path | str, geom: dict, crs_out: list) -> tuple[NDArray, Affine]:
    with rasterio.Env(**_GDAL_HTTP), rasterio.open(path) as ds:
        g = transform_geom("EPSG:4326", ds.crs, geom)
        data, tf = rio_mask(ds, [g], crop=True, nodata=0)
        crs_out.append(ds.crs)
    return data[0], tf


def _to_lonlat(geom: dict, crs: object) -> dict:
    return dict(transform_geom(crs, "EPSG:4326", geom, precision=7))


def process_plot(plot_geom: dict, scenes: Sequence[SceneFiles]) -> PlotResult:
    results: list[SceneResult] = []
    alerts: list[dict[str, Any]] = []
    prev_means: list[float] = []
    prev_arrays: list[NDArray] = []

    ordered = sorted(scenes, key=lambda s: s.date)

    def load(sf: SceneFiles) -> tuple[NDArray, Affine, NDArray, NDArray, list]:
        crs: list = []
        b04, tf = _read_clip(sf.b04, plot_geom, crs)
        b08, _ = _read_clip(sf.b08, plot_geom, crs)
        scl, _ = _read_clip(sf.scl, plot_geom, crs)
        return b04, tf, b08, scl, crs

    # I/O de rede domina: lê em paralelo; o cálculo segue em ordem de data (alertas usam histórico)
    with ThreadPoolExecutor(max_workers=_READ_THREADS) as pool:
        loaded = pool.map(load, ordered)
        for sf, (b04, tf, b08, scl, crs) in zip(ordered, loaded, strict=True):
            _process_scene(
                sf, b04, tf, b08, scl, crs, plot_geom, results, alerts, prev_means, prev_arrays
            )

    return PlotResult(results, alerts)


def _process_scene(
    sf: SceneFiles,
    b04: NDArray,
    tf: Affine,
    b08: NDArray,
    scl: NDArray,
    crs: list,
    plot_geom: dict,
    results: list[SceneResult],
    alerts: list[dict[str, Any]],
    prev_means: list[float],
    prev_arrays: list[NDArray],
) -> None:
    if scl.shape != b04.shape:  # SCL nativo é 20 m (STAC): sobe para a grade de 10 m
        scl = np.kron(scl, np.ones((2, 2), dtype=scl.dtype))
        scl = np.pad(
            scl,
            (
                (0, max(0, b04.shape[0] - scl.shape[0])),
                (0, max(0, b04.shape[1] - scl.shape[1])),
            ),
            mode="edge",
        )
        scl = scl[: b04.shape[0], : b04.shape[1]]
    inside = inside_mask(b04.shape, tf, transform_geom("EPSG:4326", crs[0], plot_geom))
    arr, valid = apply_mask(compute_ndvi(b04, b08), scl, inside)
    total = int(inside.sum())
    stats = scene_stats(arr, total) if valid else None
    pct = 100 * int(np.isfinite(arr).sum()) / total if total else 0.0
    if stats is None:
        results.append(SceneResult(sf.date, False, valid_pct=pct))
        return

    zones = [{**z, "geometry": _to_lonlat(z["geometry"], crs[0])} for z in make_zones(arr, tf)]
    results.append(
        SceneResult(
            sf.date,
            True,
            stats,
            render_png(arr),
            lonlat_bounds(tf, arr.shape, crs[0]),
            zones,
            pct,
            (arr, tf, crs[0]),
        )
    )
    for alert in (
        drop_alert(stats["mean"], prev_means),
        patch_alert(arr, tf, historical_p10(prev_arrays)),
    ):
        if alert is not None:
            if "geometry" in alert:
                alert["geometry"] = _to_lonlat(alert["geometry"], crs[0])
            alerts.append({"date": sf.date, **alert})
    prev_means.append(stats["mean"])
    prev_arrays.append(arr)
