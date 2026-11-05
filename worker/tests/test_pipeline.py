import random
from pathlib import Path

import gen_fixtures
import pytest

from app.pipeline import PlotResult, SceneFiles, process_plot


@pytest.fixture(scope="module")
def scenes(fixtures_dir: Path) -> list[SceneFiles]:
    return [
        SceneFiles(d.name, d / "B04.tif", d / "B08.tif", d / "SCL.tif")
        for d in sorted(fixtures_dir.iterdir())
    ]


def _plot(problematic: bool) -> dict:
    return next(
        p["geometry"]
        for p in gen_fixtures.load_plots()
        if p["properties"]["problematic"] == problematic
    )


@pytest.fixture(scope="module")
def sick(scenes: list[SceneFiles]) -> PlotResult:
    return process_plot(_plot(True), scenes)


def test_problem_plot_alerts(sick: PlotResult) -> None:
    kinds = {a["type"] for a in sick.alerts}
    assert kinds == {"drop", "patch"}
    assert all(a["severity"] in ("medium", "high") for a in sick.alerts)
    assert any(a["type"] == "patch" and a["severity"] == "high" for a in sick.alerts)


def test_scenes_and_invalid(sick: PlotResult) -> None:
    assert len(sick.scenes) == 12
    assert [s.date for s in sick.scenes] == sorted(s.date for s in sick.scenes)
    invalid = [s for s in sick.scenes if not s.valid]
    assert invalid and all(s.stats is None and s.png is None for s in invalid)
    ok = next(s for s in sick.scenes if s.valid)
    assert ok.png and ok.png[:4] == b"\x89PNG" and len(ok.zones) == 3 and ok.bounds


def test_healthy_plot_no_alerts(scenes: list[SceneFiles]) -> None:
    assert process_plot(_plot(False), scenes).alerts == []


def test_deterministic_and_order_independent(scenes: list[SceneFiles], sick: PlotResult) -> None:
    shuffled = scenes[:]
    random.Random(1).shuffle(shuffled)
    assert process_plot(_plot(True), shuffled) == sick


def test_problem_plot_reaches_red(sick: PlotResult, scenes: list[SceneFiles]) -> None:
    means = [s.stats["mean"] for s in sick.scenes if s.stats]
    assert means[0] > 0.75 and all(0.10 <= m <= 0.15 for m in means[-2:])
    patches = [a["areaHa"] for a in sick.alerts if a["type"] == "patch"]
    assert patches and all(1.0 < ha < 0.6 * 78.29 for ha in patches)  # mancha < talhão
    healthy = process_plot(_plot(False), scenes)
    assert all(s.stats["mean"] > 0.75 for s in healthy.scenes if s.stats)
