# Decisões

## ADRs

- **ADR-01 Fila BullMQ -> HTTP**: producer e consumer na API; o consumer chama `POST worker/process` síncrono com `WORKER_TIMEOUT_MS`. Worker stateless, sem acesso ao banco. Erros de domínio (`NO_OFFLINE_DATA`, `NO_VALID_SCENE`) -> `UnrecoverableError`; demais (timeout, 5xx, `STAC_UNAVAILABLE`) seguem `attempts:3`/backoff 5 s. `job.status=failed` só na última tentativa ou erro irrecuperável; entre tentativas fica `running`. Rejeitado: Python consumindo Redis (duas libs de fila, protocolo BullMQ não oficial em Python).
- **ADR-02 Volume compartilhado**: worker grava `/data/plots/{plotId}/{date}/...` e `/data/reports/...`; API persiste caminhos relativos e serve via `/files/*` (único ponto público, `PUBLIC_FILES_URL`). Exclusão de talhão apaga a pasta após commit do delete. Web não lê o volume diretamente. Rejeitado: S3/MinIO (fora de escopo).
- **ADR-03 DATA_MODE**: seleção no worker por `sources/__init__.py`; `auto` = STAC com `STAC_TIMEOUT_S` e fallback para fixtures com log warning; `source` retornado por resposta e gravado em `ndvi_scene.source`. `make demo`, pytest, Jest e e2e fixam `fixtures`.
- **ADR-04 Fixtures sintéticas determinísticas**: `gen_fixtures.py` com `numpy.random.default_rng(seed fixo)`, bbox ~10x10 km em (-7.23, -44.55), 12 datas fixas, B04/B08/SCL uint16 GeoTIFF (deflate, 10 m). Talhões demo vêm de `fixtures/demo-plots.geojson` (fonte única para gerador e seed). Talhão problemático garante `drop` e `patch`; nuvens parciais < 60% exercitam a máscara. Binários não versionados: gerados no Dockerfile do worker e por fixture de sessão no pytest; teste de checksum garante determinismo.
- **ADR-05 Testes offline**: pytest bloqueia socket via `conftest.py` e usa rasters em memória (bordas) + fixtures reais (pipeline); Jest unit com worker stub e integração contra Postgres do compose; Playwright contra compose em fixtures, com tiles ESRI interceptados. Asserções de UI por `data-testid`/atributos, nunca por pixel do mapa.
- **ADR-06 PDF no worker**: matplotlib (mapa NDVI + zonas + gráfico) + reportlab; recomendações por regra §8.1. Worker lê `zonesPath`/`pngPath` do volume.
- **ADR-07 Comparar**: dois mapas MapLibre sincronizados + `clip-path` no divisor; sem lib extra.

## Decisões assumidas (P1-P4)

- **P1**: em `DATA_MODE=fixtures` a janela de 6 meses é ignorada; devolve sempre as 12 datas fixas.
- **P2**: o reprocessamento remove zonas/alertas que deixaram de existir, na mesma transação (estado = último processamento).
- **P3**: o PATCH de geometria mantém cenas/zonas/alertas e marca `plot.needsReprocess=true`; a UI avisa "geometria alterada, reprocesse". O flag volta a `false` quando um job `history` termina.
- **P4**: 12 cenas a cada 15 dias; a data-base é uma constante em `gen_fixtures.py`.
- **T-34**: desenho no mapa com `@mapbox/mapbox-gl-draw` (funciona com maplibre-gl 4 trocando as classes `mapboxgl`→`maplibregl` e com estilos próprios); UI de controles própria.
- **ADR-08 Retenção e segredos**: sem auth no MVP (RN-12), então não há log de auditoria nem exportação. Dados ficam até exclusão explícita: `DELETE /farms/{id}` apaga linhas filhas por cascata no banco e, após o commit, `/data/plots/{plotId}` e `/data/reports/{plotId}` de cada talhão. Telefone (RF-19) nunca é persistido; o log mostra só `phone: "***"`. Segredos só em env: API (`DATABASE_URL`, `REDIS_URL`, `WORKER_URL`) e worker (`DATA_DIR`, `DATA_MODE`) falham no boot se faltarem (`api/src/config.ts`, `worker/app/config.py`); credenciais reais só em `.env`, apenas `.env.example` versionado.
- **T-37 Comparar (ADR-07)**: dois mapas MapLibre sincronizados (`move` bidirecional + `jumpTo`); o 2º mapa (data B) cobre o 1º (data A) com `clip-path: inset(0 0 0 X%)`, divisor arrastável por pointer events/teclado; sem `maplibre-gl-compare`.

## Decisões extras (implementação)

- **mapbox-gl-draw com maplibre 4**: ver T-34 acima; o plugin é usado trocando as classes `mapboxgl` por `maplibregl` e com estilos próprios.
- **Shadow database do Prisma**: `prisma migrate dev` precisa de um banco sombra com PostGIS; usa o Postgres do compose (imagem `postgis/postgis`). Migration aplicada nunca é editada.
- **ioredis explícito**: `ioredis` é dependência direta da API (`api/package.json`) em vez de depender da versão transitiva do BullMQ, para fixar a versão e o cliente usado na conexão.
- **Portas configuráveis**: `API_HOST_PORT`, `WEB_HOST_PORT`, `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT` e `WORKER_HOST_PORT` no compose, com os padrões 3001, 3005, 5432, 6379 e 8000. O worker publica só em 127.0.0.1. `NEXT_PUBLIC_API_URL` é embutida no build do web, então mudar `API_HOST_PORT` exige rebuild.
- **Rampa NDVI de 4 paradas**: o PNG de NDVI usa uma rampa de cor com 4 paradas (do solo/baixo ao vigoroso), simples e legível sobre o satélite.
- **Fixtures com dois focos de mancha**: o talhão problemático das fixtures tem dois focos de queda, para provar que só a maior mancha contígua conta no alerta (RN-09) e que manchas dispersas não somam.
- **WORKER_URL local vs container**: no compose é `http://worker:8000`; rodando a API fora do Docker (`.env.example`) é `http://localhost:8000` (ou `WORKER_HOST_PORT`).
- **Gancho `window.__map` só no e2e**: `MapView` só expõe o mapa quando `NEXT_PUBLIC_E2E=1` (build arg do web; `scripts/e2e.sh` liga, compose normal deixa vazio).
