import os

REQUIRED = ("DATA_DIR", "DATA_MODE")


def assert_env(env: "os._Environ[str] | dict[str, str]" = os.environ) -> None:
    missing = [k for k in REQUIRED if not env.get(k, "").strip()]
    if missing:
        raise RuntimeError(
            f"Variáveis de ambiente obrigatórias ausentes: {', '.join(missing)}. "
            "Copie .env.example para .env e preencha."
        )
