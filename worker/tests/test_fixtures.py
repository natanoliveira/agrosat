from datetime import date
from pathlib import Path

import gen_fixtures
import rasterio
from rasterio.warp import transform_bounds


def test_dates_spacing(fixtures_dir: Path) -> None:
    names = sorted(p.name for p in fixtures_dir.iterdir())
    assert len(names) == 12
    ds = [date.fromisoformat(n) for n in names]
    assert all((b - a).days == 15 for a, b in zip(ds, ds[1:], strict=False))


def test_bbox_and_plots_inside(fixtures_dir: Path) -> None:
    with rasterio.open(fixtures_dir / "2025-01-01" / "B04.tif") as ds:
        w, s, e, n = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)
        assert ds.dtypes[0] == "uint16" and ds.res == (10, 10)
    assert 0.08 < e - w < 0.1 and 0.08 < n - s < 0.1
    assert w < gen_fixtures.CENTER_LON < e and s < gen_fixtures.CENTER_LAT < n
    plots = gen_fixtures.load_plots()
    assert len(plots) == 3 and sum(p["properties"]["problematic"] for p in plots) == 1
    for p in plots:
        for lon, lat in p["geometry"]["coordinates"][0]:
            assert w < lon < e and s < lat < n


def test_checksum_stable(fixtures_dir: Path, tmp_path: Path) -> None:
    assert gen_fixtures.generate(tmp_path) == gen_fixtures.generate(tmp_path / "again")
