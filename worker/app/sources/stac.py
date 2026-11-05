from datetime import date
from typing import Any

from shapely.geometry import shape

from app.errors import WorkerError
from app.pipeline import SceneFiles

MAX_CLOUD = 60  # RN-02


class StacSource:
    name = "stac"

    def __init__(self, url: str, collection: str, timeout: float = 10, client: Any = None) -> None:
        self.url, self.collection, self.timeout, self._client = url, collection, timeout, client

    def list_scenes(self, geom: dict, date_from: date, date_to: date) -> list[SceneFiles]:
        try:
            if self._client is None:
                from pystac_client import Client

                self._client = Client.open(self.url, timeout=self.timeout)
            items = self._client.search(
                collections=[self.collection],
                intersects=shape(geom).__geo_interface__,
                datetime=f"{date_from.isoformat()}/{date_to.isoformat()}",
                query={"eo:cloud_cover": {"lt": MAX_CLOUD}},
            ).items()
            best: dict[str, Any] = {}
            for it in items:  # uma cena por data (menor nuvem)
                d = it.datetime.date().isoformat()
                cc = it.properties.get("eo:cloud_cover", 100)
                if d not in best or cc < best[d][0]:
                    best[d] = (cc, it)
            return [
                SceneFiles(
                    d,
                    it.assets["red"].href,
                    it.assets["nir"].href,
                    it.assets["scl"].href,
                )
                for d, (_, it) in sorted(best.items())
            ]
        except Exception as e:
            raise WorkerError(
                "STAC_UNAVAILABLE", "Fonte de imagens (STAC) indisponível.", 503
            ) from e
