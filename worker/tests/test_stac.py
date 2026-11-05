from datetime import UTC, datetime
from types import SimpleNamespace as NS

import pytest

from app.errors import WorkerError
from app.sources.stac import StacSource

GEOM = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}


def _item(day: int, cc: float, tag: str) -> NS:
    return NS(
        datetime=datetime(2025, 1, day, 10, tzinfo=UTC),
        properties={"eo:cloud_cover": cc},
        assets={k: NS(href=f"https://x/{tag}/{k}.tif") for k in ("red", "nir", "scl")},
    )


class FakeClient:
    def __init__(self, items: list[NS]) -> None:
        self.items = items
        self.kwargs: dict[str, object] = {}

    def search(self, **kw: object) -> NS:
        self.kwargs = kw
        return NS(items=lambda: iter(self.items))


def test_filters_cloud_and_dedupes() -> None:
    c = FakeClient([_item(5, 30, "b"), _item(1, 10, "a"), _item(5, 5, "c")])
    out = StacSource("u", "col", client=c).list_scenes(
        GEOM, *(__import__("datetime").date(2025, 1, d) for d in (1, 31))
    )
    assert [s.date for s in out] == ["2025-01-01", "2025-01-05"]
    assert out[1].b04 == "https://x/c/red.tif"
    assert c.kwargs["query"] == {"eo:cloud_cover": {"lt": 60}}


def test_unavailable() -> None:
    class Boom:
        def search(self, **_: object) -> None:
            raise OSError("sem rede")

    from datetime import date

    with pytest.raises(WorkerError) as e:
        StacSource("u", "col", client=Boom()).list_scenes(GEOM, date(2025, 1, 1), date(2025, 1, 2))
    assert (e.value.code, e.value.status) == ("STAC_UNAVAILABLE", 503)
