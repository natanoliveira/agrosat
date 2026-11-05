import io

import numpy as np
from affine import Affine
from PIL import Image

from app.render import lonlat_bounds, render_png


def _img(a: np.ndarray) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(render_png(a))))


def test_nodata_transparent_and_range() -> None:
    px = _img(np.array([[np.nan, -0.2, 0.9, 5.0, -3.0]]))
    assert px[0, 0, 3] == 0
    assert (px[0, 1:, 3] == 255).all()
    assert (px[0, 1] == px[0, 4]).all() and (px[0, 2] == px[0, 3]).all()
    assert px[0, 1, 0] > px[0, 1, 1] and px[0, 2, 1] > px[0, 2, 0]


def test_bounds_order() -> None:
    tf = Affine(0.001, 0, -44.6, 0, -0.001, -7.2)
    (w, s), (e, n) = lonlat_bounds(tf, (10, 20), "EPSG:4326")
    assert (w, s, e, n) == (-44.6, -7.21, -44.58, -7.2)
