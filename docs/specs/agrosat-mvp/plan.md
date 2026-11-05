# AgroSat MVP — Plano de implementação

Fontes: `spec.md` (RF/CA/§3–§8), `analysis.md` (RN/D). Repositório greenfield (só `init.md` e `docs/`).

## 1. Arquivos por serviço

### Raiz / infra
- `docker-compose.yml`: `postgres` (postgis/postgis:16, healthcheck `pg_isready`), `redis` (healthcheck), `worker`, `api` (depends_on healthy + `prisma migrate deploy` no entrypoint), `web`; volume `agrosat-data:/data` em api/worker/web (D-02); `./worker/fixtures/demo-plots.geojson` montado read-only na api para o seed.
- `.env.example`: todas as variáveis da spec §6.
- `Makefile`: `up`, `demo` (RF-29), `test` (Jest + pytest + lint/typecheck, RF-32), `lint`, `e2e`, `fixtures`.
- `README.md` (pt-BR, Mermaid, analogia NDVI), `DECISIONS.md` (ADRs da §4 deste plano, D-05), `TODO.md` — RF-31.
- Sem workspace tool (pnpm/turbo): cada app com seu `package.json`/lockfile. Tipos da API duplicados no web (`web/lib/api-types.ts`), sem pacote compartilhado.

### api/ (NestJS + Prisma)
- `prisma/schema.prisma`, `prisma/migrations/0001_init/migration.sql`, `prisma/seed.ts` (RF-29).
- `src/main.ts` (prefixo `/api/v1`, CORS `WEB_ORIGIN`, Swagger `/api/docs`, `ValidationPipe`).
- `src/common/`: `http-exception.filter.ts` (formato §4/§5), `errors.ts` (códigos §5), `pagination.dto.ts`, `geo.ts` (validação GeoJSON pré-banco + parse KML).
- `src/prisma/prisma.service.ts`.
- `src/farms/` (RF-01, RF-26 dashboard), `src/plots/` (RF-02..05, import RF-03), `src/jobs/` (BullMQ producer+consumer, `worker.client.ts`, RF-06/12/13/28), `src/scenes/` (scenes + pixel, RF-09/10/24), `src/zones/` (RF-14/15/25), `src/alerts/` (RF-16..18), `src/notifications/` (RF-19), `src/reports/` (RF-28), `src/files/` (`/files/*`, guarda contra `..`, §5).
- `test/` unit + integração (§7).
- `Dockerfile`.

### worker/ (FastAPI)
- `app/main.py` (rotas `/health`, `/process`, `/pixel`, `/report`), `app/errors.py` (`{code,message}` pt-BR).
- `app/ndvi.py` (RN-01), `app/mask.py` (SCL + `rasterio.mask`, RN-01/02), `app/stats.py` (RN-03), `app/render.py` (PNG rampa RF-10 + bounds), `app/zones.py` (RN-07, `rasterio.features.shapes`, área ha), `app/alerts.py` (RN-08/09/10, §8.3/§8.4/§8.6), `app/report.py` (RN-15, §8.1), `app/pipeline.py` (orquestra cenas em ordem cronológica).
- `app/sources/base.py` (contrato `list_scenes(geom, from, to)` → bandas B04/B08/SCL), `sources/stac.py` (pystac-client), `sources/fixtures.py` (bbox RN-14 → `NO_OFFLINE_DATA`), `sources/__init__.py` (seleção `DATA_MODE` + fallback `auto`, RN-13).
- `scripts/gen_fixtures.py`, `fixtures/demo-plots.geojson` (versionado), `fixtures/*.tif` (gerado, não versionado).
- `tests/` (§7), `pyproject.toml` (ruff, mypy, pytest), `Dockerfile`.

### web/ (Next.js 14 App Router)
- `app/page.tsx` (lista de fazendas / redireciona para demo), `app/farms/[id]/page.tsx` (dashboard RF-26), `app/farms/[id]/map/page.tsx` (mapa + painel), `app/alerts/page.tsx` (RF-18).
- `components/map/`: `MapView.tsx` (ESRI + overlay image source, RF-20), `DrawControl.tsx` (RF-02), `ImportButton.tsx` (RF-03), `CompareMap.tsx` (RF-22), `PixelPopup.tsx` + `Legend.tsx` (RF-24), `ZonesLayer.tsx` (RF-25).
- `components/timeline/Timeline.tsx` (RF-21), `components/charts/NdviChart.tsx` (RF-23), `components/panel/SidePanel.tsx` (bottom sheet mobile, RF-27).
- `lib/api.ts`, `lib/api-types.ts`, `lib/format.ts` (decimal pt-BR "0,72").
- Componentes de mapa com `dynamic(..., { ssr: false })`.

### e2e/
- `playwright.config.ts` (baseURL 3005, projeto desktop + mobile 375×812), `tests/*.spec.ts` (§7), `fixtures/blank-tile.png`.

## 2. Ordem de construção

| Etapa | Entrega | Depende de | Paralelo com |
|---|---|---|---|
| E0 | compose (postgres+redis), `.env.example`, Makefile esqueleto, DECISIONS.md inicial | — | — |
| E1 | Worker núcleo puro: ndvi/mask/stats/render/zones/alerts + `gen_fixtures.py` + pytest | E0 | E2, E5a |
| E2 | API base: Prisma + migration 0001, filtro de erro, farms, plots (CRUD + import), files + Jest | E0 | E1, E5a |
| E3 | Worker HTTP: sources (fixtures/stac/auto), `/process`, `/pixel`, Dockerfile | E1 | E4 (com stub) |
| E4 | API jobs: BullMQ, `worker.client`, transação de upsert, scenes/zones/alerts/pixel/dashboard/notifications | E2 (+ contrato §4 do worker; stub HTTP até E3) | E3, E5b |
| E5a | Web: layout, mapa ESRI, desenho/import, farms CRUD (contra API real de E2) | contrato §4 | E1, E2 |
| E5b | Web: overlay, timeline/play, comparar, gráfico, legenda/pixel, zonas, alertas, dashboard, mobile | E4 (ou mocks do contrato) | E3, E6 |
| E6 | Relatório: worker `/report` → API `reports` → botão no web | E1 (worker), E4 (api) | E5b |
| E7 | Seed + `make demo` ponta a ponta (CA-G1/G2/G3/G5) | E3, E4, E6 | — |
| E8 | Playwright (CA-G4) | E5b, E7 | E9 |
| E9 | README, TODO, DECISIONS final; lint/typecheck verde (RF-32) | E7 | E8 |

- Caminho crítico: E0 → E1 → E3 → E7 → E8.
- Contrato API↔worker (§4 spec) congelado antes de E3/E4; mudança nele = atualizar spec primeiro.

## 3. Migrations Prisma + PostGIS

- `schema.prisma`: `previewFeatures = ["postgresqlExtensions"]`, `extensions = [postgis]` no datasource.
- Geometria: `geom Unsupported("geometry(Polygon, 4326)")` (plot), `Unsupported("geometry(MultiPolygon, 4326)")` (zone), `Unsupported("geometry(Geometry, 4326)")?` (alert).
- GIST declarado no schema (`@@index([geom], type: Gist)`) para não gerar drift.
- `0001_init` criada com `prisma migrate dev --create-only` e editada antes do primeiro apply para:
  - `CREATE EXTENSION IF NOT EXISTS postgis;` no topo;
  - `CHECK (ST_IsValid(geom))` em `plot` (Prisma não modela CHECK; não gera drift).
- Unique/índices da §3 todos no schema (`@@unique([plotId, sceneDate])`, `@@unique([sceneId, class])`, `@@unique([plotId, sceneDate, type])`, `@@index`).
- Campo `Unsupported` obrigatório impede `prisma.plot.create()` → escrita/leitura de `plot`/`zone`/`alert.geom` só por `$queryRaw`/`$executeRaw` em repositórios dedicados (`plots.repository.ts`, `zones.repository.ts`, `alerts.repository.ts`):
  - insert/update: `ST_GeomFromGeoJSON($1)` + `areaHa = ST_Area(geom::geography)/10000` no mesmo statement (RN-04);
  - leitura: `ST_AsGeoJSON(geom)::json`.
- Validação de geometria em 2 camadas: pré-check no DTO/`geo.ts` (tipo Polygon, anel fechado, ≥ 4 pontos) + `ST_IsValid` em SQL antes do insert → `INVALID_GEOMETRY` (CA RF-02); CHECK é a rede final.
- Upsert de resultado do job (RF-12) em `prisma.$transaction(async tx => …, { timeout })`:
  - `ndvi_scene` via `tx.ndviScene.upsert` (sem geometria);
  - `zone` e `alert` via `INSERT … ON CONFLICT (…) DO UPDATE … RETURNING (xmax = 0) AS inserted`; `inserted=true` → notificação (RF-19) após commit e grava `notifiedAt`.
- 409 `JOB_IN_PROGRESS`: checagem + insert de `job` na mesma transação com `SELECT … FROM plot WHERE id=$1 FOR UPDATE` (evita corrida sem índice parcial).
- Migration aplicada nunca é editada; após merge de E2, mudança = nova migration.
- Compose usa `migrate deploy`; `migrate dev` só local.

## 4. Decisões estruturais (ADRs curtos → copiar para `DECISIONS.md`)

- **ADR-01 Fila BullMQ → HTTP (D-01)**: producer e consumer na API; consumer chama `POST worker/process` síncrono com `WORKER_TIMEOUT_MS`. Worker stateless, sem acesso ao banco. Erros de domínio (`NO_OFFLINE_DATA`, `NO_VALID_SCENE`) → `UnrecoverableError`; demais (timeout, 5xx, `STAC_UNAVAILABLE`) seguem `attempts:3`/backoff 5 s. `job.status=failed` só na última tentativa ou erro irrecuperável; entre tentativas fica `running`. Alternativa rejeitada: Python consumindo Redis (duas libs de fila, protocolo BullMQ não oficial em Python).
- **ADR-02 Volume compartilhado (D-02)**: worker grava `/data/plots/{plotId}/{date}/…` e `/data/reports/…`; API persiste caminhos relativos e serve via `/files/*` (único ponto público, `PUBLIC_FILES_URL`). Exclusão de talhão (RF-05) apaga a pasta após commit do delete. Web não lê o volume diretamente (montagem mantida só por D-02). Rejeitado: S3/MinIO (fora de escopo).
- **ADR-03 DATA_MODE (RN-13)**: seleção no worker por `sources/__init__.py`; `auto` = STAC com `STAC_TIMEOUT_S` e fallback para fixtures com log warning; `source` retornado por resposta e gravado em `ndvi_scene.source`. `make demo`, pytest, Jest e e2e fixam `fixtures`.
- **ADR-04 Fixtures sintéticas determinísticas (RN-14)**: `gen_fixtures.py` com `numpy.random.default_rng(seed fixo)`, bbox ~10×10 km centrada em (-7.23, -44.55), 12 datas fixas, B04/B08/SCL uint16 GeoTIFF (deflate, 10 m; SCL reamostrado para 10 m). Talhões demo lidos de `fixtures/demo-plots.geojson` (fonte única para gerador e seed). Talhão problemático: NDVI decai por data + mancha crescente > 3 ha nas últimas datas, garantindo `drop` e `patch` (CA-G2/G3); nuvens parciais < 60% em algumas datas para exercitar máscara. Binários não versionados: gerados no `Dockerfile` do worker e por fixture de sessão no pytest; teste de checksum garante determinismo.
- **ADR-05 Testes offline (CA-G4)**: pytest bloqueia socket via `conftest.py` (monkeypatch de `socket.socket`, sem dependência nova) e usa rasters em memória para casos de borda + fixtures reais para o pipeline; Jest unit com worker stub (nock/servidor local) e integração contra Postgres do compose; Playwright contra compose em fixtures, com tiles ESRI interceptados (`page.route` → `blank-tile.png`). Asserções de UI por `data-testid`/atributos (`data-current-date`), nunca por pixel do mapa.
- **ADR-06 PDF no worker (RN-15)**: matplotlib (mapa NDVI + zonas + gráfico) + reportlab; recomendações por regra §8.1. Worker lê `zonesPath`/`pngPath` do volume.
- **ADR-07 Comparar (RF-22)**: dois mapas MapLibre sincronizados + `clip-path` no divisor; sem lib extra.

## 5. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| rasterio/GDAL no Docker (build lento, arm64 Mac) | `python:3.11-slim` + wheels manylinux do rasterio (GDAL embutido), sem GDAL de sistema; fixar versão; testar build `linux/arm64` e `amd64` em E3 |
| Tiles ESRI exigem rede; offline o mapa fica cinza | URL do basemap em `NEXT_PUBLIC_BASEMAP_URL`; e2e intercepta tiles; README explica |
| MapLibre image source: CORS, coords, cache | `/files/*` com CORS `WEB_ORIGIN` e `Content-Type` correto; converter `[[w,s],[e,n]]` → `[[w,n],[e,n],[e,s],[w,s]]` em `lib/geo.ts`; pré-carregar PNGs antes do play; `updateImage` ao trocar data |
| MapLibre + WebGL em Chromium headless | `launchOptions.args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader']`; aguardar evento `idle` exposto em `data-map-ready` |
| `maplibre-gl-draw` com compatibilidade parcial | Validar em E5a; plano B `@mapbox/mapbox-gl-draw` com patch de classes CSS do MapLibre |
| Playwright com compose (ordem de subida, estado sujo) | `make e2e` = `compose up --wait` (healthchecks) + `make demo` + testes; nomes de fazenda únicos por teste; `compose down -v` opcional |
| Tempo de processamento (STAC real, 6 meses, HTTP síncrono) | Filtro STAC `eo:cloud_cover` + leitura em janela do COG só no bbox do talhão; `WORKER_TIMEOUT_MS` generoso; concorrência 2; fixtures em segundos |
| Transação interativa Prisma estoura timeout (default 5 s) | `timeout` explícito; inserts de zona em lote |
| Prisma vs PostGIS (drift com `spatial_ref_sys`, Unsupported) | Extensão via `extensions`; geometria só por SQL raw em repositórios; `migrate deploy` no compose |
| Fixtures com datas fixas saem da janela "hoje − 6 meses" | Ver Pergunta em aberto 1 |
| Thresholds do talhão doente não disparam alerta | Teste pytest do pipeline sobre fixtures exige `drop` e `patch` no talhão problemático |

## 6. Rollback por etapa

- Geral: cada etapa = commits próprios; rollback = `git revert` da etapa. Dados de dev: `docker compose down -v` + `make demo`.
- E0: remover serviços do compose; sem estado.
- E1/E3 (worker): stateless; revert + rebuild da imagem; arquivos do volume regeneráveis por reprocessamento.
- E2 (schema): antes de merge, `migrate reset` local; após merge, rollback só por nova migration reversa (nunca editar `0001_init`).
- E4 (fila): jobs pendentes no Redis descartáveis (`FLUSHDB` em dev); `job` órfãos `queued/running` marcados `failed` por script/SQL.
- E5 (web): revert; sem estado.
- E6 (relatório): revert; PDFs no volume ficam órfãos (inofensivos), tabela `report` intacta.
- E7 (seed): idempotente por nome (CA RF-29); desfazer = `DELETE FROM farm WHERE name=…` (cascata).
- E8/E9: só testes/docs.

## 7. Alinhamentos da spec (sem regra nova)

- §8.5 → resposta de import vira `201 {created: Feature[], ignored: number}` (tabela §4 cita só `created`).
- §8.2 → `currentNdvi` = `mean` da última cena válida; `trend` conforme §8.2; `null` sem cenas.
- §8.3 → `alert.value` do `patch` = área da maior mancha; `geom` = geometria dela.
- `GET /jobs/:id.result` = `{validScenes, discardedScenes, source}` (CA RF-06/13).

## 8. Perguntas em aberto

1. Fixtures têm 12 datas fixas, mas a janela é "hoje − 6 meses" (RN-06): com o tempo as datas saem da janela e CA-G2 quebra. Proposta: em `DATA_MODE=fixtures` ignorar a janela e devolver as 12 datas fixas (re-datar quebraria o upsert de RF-12). Confirmar.
2. Reprocessamento com resultado diferente (STAC): alertas/zonas que deixam de existir na janela são removidos ou mantidos? Proposta: remover dentro da mesma transação (estado = último processamento).
3. PATCH de geometria do talhão (RF-05): cenas/zonas/alertas antigos ficam até reprocessar, são apagados ou o reprocessamento é disparado automaticamente? Proposta: manter e mostrar aviso "geometria alterada, reprocesse".
4. Datas concretas das 12 cenas fixture e intervalo (ex.: a cada ~15 dias)? Proposta: 12 datas a cada 15 dias terminando na data de geração do gerador fixada no script.
