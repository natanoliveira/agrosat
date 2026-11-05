from typing import Any

import numpy as np
from affine import Affine
from numpy.typing import NDArray
from rasterio.features import shapes
from shapely.geometry import MultiPolygon, mapping, shape
from shapely.ops import unary_union

CLASSES = ("low", "medium", "high")


def make_zones(ndvi: NDArray, transform: Affine) -> list[dict[str, Any]]:
    valid = np.isfinite(ndvi)
    if not valid.any():
        return []
    q33, q66 = np.percentile(ndvi[valid], [33, 66])
    cls = np.zeros(ndvi.shape, dtype=np.uint8)
    cls[valid] = np.where(ndvi[valid] <= q33, 1, np.where(ndvi[valid] <= q66, 2, 3))
    pixel_ha = abs(transform.a * transform.e) / 10_000
    zones = []
    for i, name in enumerate(CLASSES, start=1):
        polys = [
            shape(g)
            for g, v in shapes(cls, mask=cls > 0, transform=transform, connectivity=4)
            if v == i
        ]
        geom = unary_union(polys) if polys else MultiPolygon()
        if geom.geom_type == "Polygon":
            geom = MultiPolygon([geom])
        zones.append(
            {
                "class": name,
                "areaHa": float((cls == i).sum() * pixel_ha),
                "geometry": mapping(geom),
            }
        )
    return zones
