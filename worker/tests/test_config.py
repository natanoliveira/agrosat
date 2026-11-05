import pytest

from app.config import assert_env


def test_assert_env() -> None:
    assert_env({"DATA_DIR": "/data", "DATA_MODE": "fixtures"})
    with pytest.raises(RuntimeError, match="DATA_DIR"):
        assert_env({"DATA_MODE": "fixtures"})
