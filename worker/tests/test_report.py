import io
import json
from pathlib import Path

import gen_fixtures
import numpy as np
from pypdf import PdfReader

from app.render import render_png
from app.report import build_pdf, direction, recommendations

PLOT = gen_fixtures.load_plots()[0]
GEOM = PLOT["geometry"]


def _patch_at(dx: float, dy: float) -> dict:
    xs = [p[0] for p in GEOM["coordinates"][0]]
    ys = [p[1] for p in GEOM["coordinates"][0]]
    cx, cy = sum(xs) / len(xs) + dx, sum(ys) / len(ys) + dy
    d = 0.001
    ring = [
        [cx - d, cy - d],
        [cx + d, cy - d],
        [cx + d, cy + d],
        [cx - d, cy + d],
        [cx - d, cy - d],
    ]
    return {
        "date": "2025-06-15",
        "type": "patch",
        "severity": "high",
        "value": 4.2,
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def test_direction() -> None:
    assert (
        direction(1, 1) == "nordeste" and direction(0, -1) == "sul" and direction(-1, 0) == "oeste"
    )


def test_recommendations() -> None:
    plot = {"name": "Talhão 3", "geometry": GEOM}
    assert (
        "investigar porção nordeste do Talhão 3"
        in recommendations(plot, [_patch_at(0.01, 0.01)])[0]
    )
    drop = {"date": "x", "type": "drop", "severity": "high", "value": 27.3, "geometry": None}
    assert "queda de 27% no NDVI" in recommendations(plot, [drop])[0]


def test_pdf(tmp_path: Path) -> None:
    (tmp_path / "n.png").write_bytes(render_png(np.random.default_rng(0).uniform(0, 0.9, (40, 40))))
    (tmp_path / "z.json").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {"type": "MultiPolygon", "coordinates": [GEOM["coordinates"]]},
                    }
                ],
            }
        )
    )
    body = {
        "plot": {"id": "p", "name": "Talhão 3", "areaHa": 30, "geometry": GEOM},
        "scenes": [{"date": f"2025-0{i}-01", "mean": 0.8 - i / 10} for i in range(1, 5)],
        "alerts": [_patch_at(0.01, 0.01)],
        "latest": {
            "pngPath": "n.png",
            "bounds": [[-44.6, -7.25], [-44.55, -7.2]],
            "zonesPath": "z.json",
        },
    }
    pdf = build_pdf(body, tmp_path)
    assert pdf[:5] == b"%PDF-"
    text = " ".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages)
    assert "investigar porção nordeste" in text and "Recomendações" in text
