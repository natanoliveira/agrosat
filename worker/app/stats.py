from typing import TypedDict

import numpy as np
from numpy.typing import NDArray


class Stats(TypedDict):
    mean: float
    median: float
    p10: float
    p90: float
    validPct: float


def scene_stats(ndvi: NDArray, total_pixels: int) -> Stats | None:
    v = ndvi[np.isfinite(ndvi)]
    if v.size == 0 or total_pixels <= 0:
        return None
    p10, median, p90 = (float(x) for x in np.percentile(v, [10, 50, 90]))
    return {
        "mean": float(v.mean()),
        "median": median,
        "p10": p10,
        "p90": p90,
        "validPct": 100 * v.size / total_pixels,
    }
