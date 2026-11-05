import logging
from datetime import date
from pathlib import Path

import gen_fixtures
import pytest

from app import sources
from app.errors import WorkerError
from app.sources.fixtures import FixturesSource

W = (date(2020, 1, 1), date(2020, 2, 1))
INSIDE = gen_fixtures.load_plots()[0]["geometry"]
OUTSIDE = {"type": "Polygon", "coordinates": [[[-40, -7], [-39.9, -7], [-39.9, -6.9], [-40, -7]]]}


def test_fixtures_all_dates_any_window(fixtures_dir: Path) -> None:
    assert len(FixturesSource(fixtures_dir).list_scenes(INSIDE, *W)) == 12


def test_outside_bbox(fixtures_dir: Path) -> None:
    with pytest.raises(WorkerError) as e:
        FixturesSource(fixtures_dir).list_scenes(OUTSIDE, *W)
    assert e.value.code == "NO_OFFLINE_DATA"


def test_auto_falls_back(fixtures_dir: Path, monkeypatch: pytest.MonkeyPatch, caplog) -> None:
    monkeypatch.setenv("DATA_MODE", "auto")
    monkeypatch.setenv("FIXTURES_DIR", str(fixtures_dir.parent))
    monkeypatch.setattr(sources, "_fixtures", lambda: FixturesSource(fixtures_dir))
    with caplog.at_level(logging.WARNING):
        src, scenes = sources.list_scenes(INSIDE, *W)  # rede bloqueada pelo conftest
    assert src == "fixtures" and len(scenes) == 12 and "STAC indisponível" in caplog.text


def test_fixtures_mode_no_stac(fixtures_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATA_MODE", "fixtures")
    monkeypatch.setattr(sources, "_fixtures", lambda: FixturesSource(fixtures_dir))
    assert sources.list_scenes(INSIDE, *W)[0] == "fixtures"
