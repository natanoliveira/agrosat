import numpy as np
from numpy.typing import NDArray


def ndvi(b04: NDArray, b08: NDArray) -> NDArray[np.float64]:
    red = b04.astype(np.float64)
    nir = b08.astype(np.float64)
    total = nir + red
    out = np.full(total.shape, np.nan)
    np.divide(nir - red, total, out=out, where=total != 0)
    return out
