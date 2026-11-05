import socket

import pytest


def test_socket_blocked() -> None:
    with pytest.raises(RuntimeError):
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("example.com", 80))
