# AgroSat

Monitor de lavoura por NDVI (Sentinel-2), UI 100% pt-BR. Specs: `docs/specs/agrosat-mvp/`. Pendências: `TODO.md`. Decisões: `DECISIONS.md`. Fluxos: `docs/fluxos.md`. Previews de UI: `previews/`.

## Estrutura
- `api/` NestJS + Prisma + PostGIS (`/api/v1`); geometria via SQL raw (`plots.repository.ts`); jobs BullMQ chamam o worker por HTTP
- `worker/` FastAPI + rasterio; `DATA_MODE=auto|stac|fixtures`; fixtures em `worker/scripts/gen_fixtures.py` (usar `.venv`)
- `web/` Next 14 + MapLibre GL 4 (não subir para 6.x); `NEXT_PUBLIC_*` é embutida no build
- `e2e/` Playwright via `make e2e` (`scripts/e2e.sh`, projeto compose isolado)

## Comandos
- `docker compose up -d --build --wait` e `make demo` → http://localhost:3005
- `make lint`, `make test`, `make test-int`, `make e2e`, `make audit`
- Portas do host: `API_HOST_PORT`, `WEB_HOST_PORT`, `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`, `WORKER_HOST_PORT`; mudou `WEB_HOST_PORT` → ajuste `WEB_ORIGIN`; mudou `API_HOST_PORT` → rebuild do web

## Regras
- Migration aplicada nunca é editada; mudança = nova migration
- Telefone (WhatsApp) nunca persistido nem logado (`phone: "***"`); DELETE de fazenda apaga em cascata banco e volume
- Não usar `nest start --watch` em paralelo (compartilha `api/dist`); processos soltos consomem a fila do Redis
- `lint` e `test` precisam passar offline; testes do worker bloqueiam rede

## Codebase Overview
Monorepo de 3 serviços: web (Next) → api (NestJS, fila BullMQ) → worker (FastAPI/rasterio), com Postgres/PostGIS e volume `/data` compartilhado.

Mapa detalhado (módulos, rotas, fluxo, "onde mexer"): [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).
