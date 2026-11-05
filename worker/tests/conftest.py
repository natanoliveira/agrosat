import socket
from pathlib import Path

import gen_fixtures
import pytest


@pytest.fixture(autouse=True)
def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def _blocked(*_: object, **__: object) -> None:
        raise RuntimeError("rede bloqueada nos testes (CA-G4)")

    # só conexões: TestClient/asyncio precisam de socketpair local
    monkeypatch.setattr(socket.socket, "connect", _blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", _blocked)


@pytest.fixture(scope="session")
def fixtures_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    out = tmp_path_factory.mktemp("fixtures")
    gen_fixtures.generate(out)
    return out
