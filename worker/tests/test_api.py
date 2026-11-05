from pathlib import Path

import gen_fixtures
import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.warp import transform as warp_transform

from app.main import app
from app.sources.fixtures import FixturesSource

PLOTS = gen_fixtures.load_plots()
SICK = next(p for p in PLOTS if p["properties"]["problematic"])
BODY = {
    "plotId": "p1",
    "plotName": "Doente",
    "geometry": SICK["geometry"],
    "dateFrom": "2025-01-01",
    "dateTo": "2025-06-30",
}


@pytest.fixture
def client(fixtures_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    from app import sources

    monkeypatch.setenv("DATA_MODE", "fixtures")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setattr(sources, "_fixtures", lambda: FixturesSource(fixtures_dir))
    return TestClient(app)


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok", "dataMode": "fixtures"}


def test_process_pixel_report(client: TestClient, tmp_path: Path) -> None:
    r = client.post("/process", json=BODY)
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "fixtures" and len(d["scenes"]) == 12
    ok = [s for s in d["scenes"] if s["valid"]]
    assert [s["date"] for s in d["scenes"]] == sorted(s["date"] for s in d["scenes"])
    last = ok[-1]
    assert set(last["stats"]) == {"mean", "median", "p10", "p90"}
    assert (tmp_path / last["pngPath"]).is_file() and last["zones"]["features"]
    bad = next(s for s in d["scenes"] if not s["valid"])
    assert bad["stats"] is None and bad["ndviPath"] is None and bad["zones"] is None
    alerts = [a for s in d["scenes"] for a in s["alerts"]]
    assert {a["type"] for a in alerts} == {"drop", "patch"}

    (w, s), (e, n) = last["bounds"]
    inside = client.post(
        "/pixel",
        json={
            "ndviPath": last["ndviPath"],
            "lng": SICK["geometry"]["coordinates"][0][0][0] + 0.002,
            "lat": SICK["geometry"]["coordinates"][0][0][1] + 0.002,
        },
    )
    assert inside.status_code == 200 and isinstance(inside.json()["ndvi"], float)
    out = client.post("/pixel", json={"ndviPath": last["ndviPath"], "lng": w - 0.1, "lat": s - 0.1})
    assert out.json() == {"ndvi": None}
    masked = None
    for sc in ok:  # cena com nuvem parcial: pixel mascarado dentro da janela
        with rasterio.open(tmp_path / sc["ndviPath"]) as ds:
            nan = np.argwhere(np.isnan(ds.read(1)))
            if len(nan):
                x, y = ds.xy(*nan[0])
                lng, lat = (v[0] for v in warp_transform(ds.crs, "EPSG:4326", [x], [y]))
                masked = {"ndviPath": sc["ndviPath"], "lng": lng, "lat": lat}
                break
    assert masked
    far = client.post("/pixel", json=masked)
    assert far.json() == {"ndvi": None}

    assert (
        client.post("/pixel", json={"ndviPath": "nada.tif", "lng": 0, "lat": 0}).status_code == 404
    )
    assert client.post("/pixel", json={"ndviPath": "../x", "lng": 0, "lat": 0}).status_code == 404

    rep = client.post(
        "/report",
        json={
            "plot": {"id": "p1", "name": "Doente", "areaHa": 30, "geometry": SICK["geometry"]},
            "scenes": [{"date": s["date"], **s["stats"]} for s in ok],
            "alerts": [{"date": s["date"], **a} for s in d["scenes"] for a in s["alerts"]],
            "latest": {
                "pngPath": last["pngPath"],
                "bounds": last["bounds"],
                "zonesPath": last["pngPath"].replace("ndvi.png", "zones.geojson"),
            },
        },
    )
    assert rep.status_code == 200
    assert (tmp_path / rep.json()["pdfPath"]).read_bytes()[:5] == b"%PDF-"


def test_errors(client: TestClient) -> None:
    far = {"type": "Polygon", "coordinates": [[[-40, -7], [-39.9, -7], [-39.9, -6.9], [-40, -7]]]}
    r = client.post("/process", json={**BODY, "geometry": far})
    assert r.status_code == 422 and r.json()["code"] == "NO_OFFLINE_DATA"
    r = client.post("/process", json={"plotId": "x"})
    assert r.status_code == 400 and r.json()["code"] == "VALIDATION_ERROR"
    r = client.post("/process", json={**BODY, "geometry": {"type": "Point", "coordinates": [0, 0]}})
    assert r.status_code == 400
    r = client.post(
        "/report",
        json={
            "plot": {"id": "p1", "name": "x", "areaHa": 1, "geometry": SICK["geometry"]},
            "scenes": [],
            "alerts": [],
            "latest": {"pngPath": "no.png", "bounds": [[0, 0], [1, 1]], "zonesPath": "no.json"},
        },
    )
    assert r.status_code == 400
