from typing import Any

import numpy as np
from affine import Affine

from app.alerts import drop_alert, historical_p10, patch_alert

TF = Affine(10, 0, 0, 0, -10, 1000)


def _ok(a: dict[str, Any] | None) -> dict[str, Any]:
    assert a is not None
    return a


def test_drop_needs_three_scenes() -> None:
    assert drop_alert(0.1, [0.8, 0.8]) is None


def test_drop_severity() -> None:
    prev = [0.9, 0.8, 0.8, 0.8]
    assert drop_alert(0.8 * 0.9, prev) is None
    assert drop_alert(0.8 * 0.85, prev) is None
    assert _ok(drop_alert(0.8 * 0.80, prev))["severity"] == "medium"
    assert _ok(drop_alert(0.8 * 0.76, prev))["severity"] == "medium"
    assert _ok(drop_alert(0.8 * 0.70, prev))["severity"] == "high"


def _scene(h: int, w: int) -> np.ndarray:
    a = np.full((100, 100), 0.8)
    a[:h, :w] = 0.1
    return a


def test_patch_severity() -> None:
    p10 = historical_p10([np.full((10, 10), 0.7)])
    assert p10 == 0.7
    assert patch_alert(_scene(10, 10), TF, p10) is None
    assert _ok(patch_alert(_scene(11, 10), TF, p10))["severity"] == "medium"
    assert _ok(patch_alert(_scene(30, 10), TF, p10))["severity"] == "medium"
    big = _ok(patch_alert(_scene(31, 10), TF, p10))
    assert big["severity"] == "high" and np.isclose(big["areaHa"], 3.1)


def test_patch_without_history() -> None:
    assert historical_p10([]) is None
    assert patch_alert(_scene(50, 50), TF, None) is None


def test_scattered_pixels_do_not_add_up() -> None:
    a = np.full((100, 100), 0.8)
    a[::2, ::2] = 0.1
    assert patch_alert(a, TF, 0.7) is None
