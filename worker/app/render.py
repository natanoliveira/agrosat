import io

import numpy as np
from affine import Affine
from numpy.typing import NDArray
from PIL import Image
from rasterio.warp import transform_bounds

NDVI_MIN, NDVI_MAX = -0.2, 0.9
_STOPS = [-0.2, 0.15, 0.5, 0.9]
_COLORS = np.array([[215, 48, 39], [215, 48, 39], [254, 224, 80], [26, 152, 80]], dtype=np.float64)


def render_png(ndvi: NDArray) -> bytes:
    valid = np.isfinite(ndvi)
    x = np.clip(np.where(valid, ndvi, NDVI_MIN), NDVI_MIN, NDVI_MAX)
    rgba = np.zeros((*ndvi.shape, 4), dtype=np.uint8)
    for c in range(3):
        rgba[..., c] = np.rint(np.interp(x, _STOPS, _COLORS[:, c]))
    rgba[..., 3] = np.where(valid, 255, 0)
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, format="PNG")
    return buf.getvalue()


def lonlat_bounds(transform: Affine, shape: tuple[int, int], crs: object) -> list[list[float]]:
    h, w = shape
    left, top = transform @ (0, 0)
    right, bottom = transform @ (w, h)
    west, south, east, north = transform_bounds(
        crs, "EPSG:4326", left, min(top, bottom), right, max(top, bottom)
    )
    return [[west, south], [east, north]]
