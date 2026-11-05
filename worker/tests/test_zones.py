import numpy as np
from affine import Affine
from shapely.geometry import shape

from app.zones import make_zones


def test_three_classes_cover_valid_area() -> None:
    tf = Affine(10, 0, 0, 0, -10, 300)
    a = np.linspace(0, 1, 900).reshape(30, 30)
    a[:3] = np.nan
    zones = make_zones(a, tf)
    assert [z["class"] for z in zones] == ["low", "medium", "high"]
    valid_ha = np.isfinite(a).sum() * 0.01
    assert np.isclose(sum(z["areaHa"] for z in zones), valid_ha)
    for z in zones:
        assert np.isclose(shape(z["geometry"]).area / 1e4, z["areaHa"])
    assert np.isclose(zones[0]["areaHa"] / valid_ha, 0.33, atol=0.02)


def test_all_nodata() -> None:
    assert make_zones(np.full((3, 3), np.nan), Affine(10, 0, 0, 0, -10, 30)) == []
