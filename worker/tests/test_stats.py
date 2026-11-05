import numpy as np

from app.stats import scene_stats


def test_stats() -> None:
    a = np.array([[np.nan, 0.0, 0.1], [0.2, 0.3, 0.4]])
    s = scene_stats(a, 6)
    assert s is not None
    assert np.isclose(s["mean"], 0.2) and np.isclose(s["median"], 0.2)
    assert np.isclose(s["p10"], 0.04) and np.isclose(s["p90"], 0.36)
    assert np.isclose(s["validPct"], 5 / 6 * 100)


def test_all_nodata() -> None:
    assert scene_stats(np.full((2, 2), np.nan), 4) is None
