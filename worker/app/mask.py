import numpy as np
from affine import Affine
from numpy.typing import NDArray
from rasterio.features import geometry_mask

INVALID_SCL = (3, 8, 9, 10)
MAX_INVALID_PCT = 60


def inside_mask(shape: tuple[int, int], transform: Affine, geom: dict) -> NDArray[np.bool_]:
    return geometry_mask([geom], out_shape=shape, transform=transform, invert=True)


def apply_mask(
    ndvi: NDArray, scl: NDArray, inside: NDArray[np.bool_]
) -> tuple[NDArray[np.float64], bool]:
    out = np.where(inside & ~np.isin(scl, INVALID_SCL), ndvi, np.nan)
    total = int(inside.sum())
    invalid = total - int(np.isfinite(out).sum())
    return out, total > 0 and invalid * 100 <= MAX_INVALID_PCT * total
