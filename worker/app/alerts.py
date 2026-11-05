from collections.abc import Sequence
from typing import Any

import numpy as np
from affine import Affine
from numpy.typing import NDArray
from rasterio.features import shapes
from shapely.geometry import mapping, shape

MIN_PREV_SCENES = 3
DROP_MEDIUM, DROP_HIGH = 0.85, 0.75
PATCH_MEDIUM_HA, PATCH_HIGH_HA = 1.0, 3.0


def drop_alert(mean: float, prev_means: Sequence[float]) -> dict[str, Any] | None:
    if len(prev_means) < MIN_PREV_SCENES:
        return None
    base = float(np.median(prev_means[-MIN_PREV_SCENES:]))
    if base <= 0 or mean >= DROP_MEDIUM * base:
        return None
    severity = "high" if mean < DROP_HIGH * base else "medium"
    return {"type": "drop", "severity": severity, "dropPct": 100 * (1 - mean / base)}


def historical_p10(prev: Sequence[NDArray]) -> float | None:
    vals = [a[np.isfinite(a)] for a in prev]
    if not vals or sum(v.size for v in vals) == 0:
        return None
    return float(np.percentile(np.concatenate(vals), 10))


def patch_alert(ndvi: NDArray, transform: Affine, p10: float | None) -> dict[str, Any] | None:
    if p10 is None:
        return None
    low = np.isfinite(ndvi) & (ndvi < p10)
    best, best_ha = None, 0.0
    for g, _ in shapes(low.astype(np.uint8), mask=low, transform=transform, connectivity=4):
        poly = shape(g)
        ha = poly.area / 10_000
        if ha > best_ha:
            best, best_ha = poly, ha
    if best is None or best_ha <= PATCH_MEDIUM_HA:
        return None
    severity = "high" if best_ha > PATCH_HIGH_HA else "medium"
    return {"type": "patch", "severity": severity, "areaHa": best_ha, "geometry": mapping(best)}
