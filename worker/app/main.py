import json
import logging
import math
import os
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from rasterio.warp import transform as warp_transform

from app import report as report_mod
from app.config import assert_env
from app.errors import WorkerError
from app.pipeline import SceneResult, process_plot
from app.sources import data_mode, list_scenes

log = logging.getLogger("agrosat.worker")


@asynccontextmanager
async def _lifespan(_: FastAPI):
    assert_env()
    yield


app = FastAPI(title="agrosat-worker", lifespan=_lifespan)


def data_dir() -> Path:
    return Path(os.environ.get("DATA_DIR", "/data"))


@app.exception_handler(WorkerError)
async def _worker_error(_: Request, e: WorkerError) -> JSONResponse:
    return JSONResponse({"code": e.code, "message": e.message}, status_code=e.status)


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, e: RequestValidationError) -> JSONResponse:
    msg = "; ".join(f"{'.'.join(map(str, x['loc'][1:]))}: {x['msg']}" for x in e.errors())
    return JSONResponse(
        {"code": "VALIDATION_ERROR", "message": f"Requisição inválida: {msg}"}, status_code=400
    )


@app.exception_handler(Exception)
async def _internal(_: Request, e: Exception) -> JSONResponse:
    log.exception("erro interno")
    return JSONResponse({"code": "INTERNAL", "message": "Erro interno do worker."}, status_code=500)


class ProcessIn(BaseModel):
    plotId: str
    plotName: str
    geometry: dict
    dateFrom: date
    dateTo: date


class PixelIn(BaseModel):
    ndviPath: str
    lng: float
    lat: float


class ReportPlot(BaseModel):
    id: str
    name: str
    areaHa: float
    geometry: dict


class ReportLatest(BaseModel):
    pngPath: str
    bounds: list[list[float]]
    zonesPath: str


class ReportIn(BaseModel):
    plot: ReportPlot
    scenes: list[dict[str, Any]]
    alerts: list[dict[str, Any]]
    latest: ReportLatest


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "dataMode": data_mode()}


def _safe(rel: str) -> Path:
    root = data_dir().resolve()
    p = (root / rel).resolve()
    if not p.is_relative_to(root):
        raise WorkerError("NOT_FOUND", "Arquivo não encontrado.", 404)
    return p


def _write_scene(root: Path, plot_id: str, s: SceneResult) -> dict[str, str]:
    rel = Path("plots") / plot_id / s.date
    (root / rel).mkdir(parents=True, exist_ok=True)
    assert s.raster is not None and s.png is not None
    arr, tf, crs = s.raster
    (root / rel / "ndvi.png").write_bytes(s.png)
    with rasterio.open(
        root / rel / "ndvi.tif",
        "w",
        driver="GTiff",
        height=arr.shape[0],
        width=arr.shape[1],
        count=1,
        dtype="float32",
        crs=crs,
        transform=tf,
        nodata=math.nan,
        compress="deflate",
    ) as dst:
        dst.write(arr.astype("float32"), 1)
    fc = _fc(s)
    (root / rel / "zones.geojson").write_text(json.dumps(fc))
    return {"pngPath": str(rel / "ndvi.png"), "ndviPath": str(rel / "ndvi.tif")}


def _fc(s: SceneResult) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": z["geometry"],
                "properties": {"class": z["class"], "areaHa": z["areaHa"], "date": s.date},
            }
            for z in s.zones
        ],
    }


@app.post("/process")
def process(body: ProcessIn) -> dict[str, Any]:
    if body.geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise WorkerError("VALIDATION_ERROR", "A geometria deve ser Polygon ou MultiPolygon.", 400)
    if body.dateFrom > body.dateTo:
        raise WorkerError("VALIDATION_ERROR", "dateFrom deve ser anterior a dateTo.", 400)
    source, files = list_scenes(body.geometry, body.dateFrom, body.dateTo)
    result = process_plot(body.geometry, files)
    by_date: dict[str, list[dict[str, Any]]] = {}
    for a in result.alerts:
        by_date.setdefault(a["date"], []).append(
            {
                "type": a["type"],
                "severity": a["severity"],
                "value": a["dropPct"] if a["type"] == "drop" else a["areaHa"],
                "geometry": a.get("geometry"),
            }
        )
    root = data_dir()
    scenes = []
    for s in result.scenes:
        paths = _write_scene(root, body.plotId, s) if s.valid else {}
        scenes.append(
            {
                "date": s.date,
                "valid": s.valid,
                "validPct": s.valid_pct,
                "stats": {k: s.stats[k] for k in ("mean", "median", "p10", "p90")}  # type: ignore[literal-required]
                if s.stats
                else None,
                "pngPath": paths.get("pngPath"),
                "ndviPath": paths.get("ndviPath"),
                "bounds": s.bounds,
                "zones": _fc(s) if s.valid else None,
                "alerts": by_date.get(s.date, []),
            }
        )
    return {"source": source, "scenes": scenes}


@app.post("/pixel")
def pixel(body: PixelIn) -> dict[str, float | None]:
    path = _safe(body.ndviPath)
    if not path.is_file():
        raise WorkerError("NOT_FOUND", "Raster de NDVI não encontrado.", 404)
    with rasterio.open(path) as ds:
        (x,), (y,) = warp_transform("EPSG:4326", ds.crs, [body.lng], [body.lat])
        row, col = ds.index(x, y)
        if not (0 <= row < ds.height and 0 <= col < ds.width):
            return {"ndvi": None}
        v = float(ds.read(1, window=((row, row + 1), (col, col + 1)))[0, 0])
    return {"ndvi": None if np.isnan(v) else v}


@app.post("/report")
def report(body: ReportIn) -> dict[str, str]:
    root = data_dir()
    rel = Path("reports") / body.plot.id / f"{datetime.now():%Y%m%dT%H%M%S}.pdf"
    out = _safe(str(rel))
    out.parent.mkdir(parents=True, exist_ok=True)
    for p in (body.latest.pngPath, body.latest.zonesPath):
        if not _safe(p).is_file():
            raise WorkerError("VALIDATION_ERROR", f"Arquivo não encontrado: {p}", 400)
    out.write_bytes(report_mod.build_pdf(body.model_dump(), root))
    return {"pdfPath": str(rel)}
