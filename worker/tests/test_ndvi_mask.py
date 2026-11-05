import numpy as np
from affine import Affine

from app.mask import apply_mask, inside_mask
from app.ndvi import ndvi


def test_ndvi_values() -> None:
    b04 = np.array([[1000, 2000]])
    b08 = np.array([[3000, 2000]])
    assert np.allclose(ndvi(b04, b08), [[0.5, 0.0]], atol=1e-6)


def test_zero_sum_is_nodata() -> None:
    out = ndvi(np.array([[0, 1]]), np.array([[0, 1]]))
    assert np.isnan(out[0, 0]) and out[0, 1] == 0.0


def test_scl_classes_masked() -> None:
    n = np.full((1, 6), 0.5)
    scl = np.array([[3, 8, 9, 10, 4, 5]])
    out, _ = apply_mask(n, scl, np.ones((1, 6), dtype=bool))
    assert np.isnan(out[0, :4]).all() and (out[0, 4:] == 0.5).all()


def _valid(invalid: int, total: int = 10) -> bool:
    scl = np.array([[9] * invalid + [4] * (total - invalid)])
    return apply_mask(np.full((1, total), 0.5), scl, np.ones((1, total), dtype=bool))[1]


def test_coverage_threshold() -> None:
    assert _valid(6)
    assert not _valid(7)


def test_outside_polygon_ignored() -> None:
    tf = Affine(10, 0, 0, 0, -10, 40)
    poly = {"type": "Polygon", "coordinates": [[[0, 0], [20, 0], [20, 40], [0, 40], [0, 0]]]}
    inside = inside_mask((4, 4), tf, poly)
    assert inside.sum() == 8
    out, valid = apply_mask(np.full((4, 4), 0.5), np.full((4, 4), 4), inside)
    assert valid and np.isfinite(out).sum() == 8
