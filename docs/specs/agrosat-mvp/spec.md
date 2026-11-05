# AgroSat MVP — Especificação

Fontes: `init.md`, `analysis.md` (RN-xx, D-xx). UI pt-BR; código em inglês.

## 1. Requisitos funcionais

### Fazendas e talhões (init §1)
- RF-01 CRUD de fazenda: `name`, `municipality`, `state` (UF, 2 letras).
- RF-02 Criar talhão desenhando polígono no mapa (MapLibre + maplibre-gl-draw) — RN-04, RN-05.
- RF-03 Importar talhões por upload GeoJSON/KML — RN-05; MultiPolygon explodido em N talhões.
- RF-04 Área (ha) calculada no banco ao criar/editar geometria — RN-04.
- RF-05 Editar nome/geometria e excluir talhão (cascata: cenas, zonas, alertas, relatórios, arquivos).

### Processamento NDVI (init §2)
- RF-06 Job "histórico" por talhão (e por fazenda = todos os talhões) — RN-06, D-01.
- RF-07 Cálculo NDVI + máscara SCL + recorte pelo polígono (`rasterio.mask`) — RN-01.
- RF-08 Descarte de cena por cobertura — RN-02 (cena persiste com `valid=false`, sem stats).
- RF-09 Estatísticas por talhão+data — RN-03.
- RF-10 PNG colorido (rampa vermelho→amarelo→verde, -0.2 a 0.9, nodata transparente) + bounds `[[w,s],[e,n]]`, servido como image source.
- RF-11 Fonte de dados por `DATA_MODE` — RN-13, RN-14.
- RF-12 Reprocessamento idempotente (upsert por talhão+data).
- RF-13 Status de job consultável (queued/running/completed/failed + mensagem pt-BR).

### Zonas de manejo (init §3)
- RF-14 Zonas por cena válida — RN-07 (3 classes, vetorizadas via `rasterio.features.shapes`, área ha por zona).
- RF-15 Exportar zonas como GeoJSON (download) — RN-07.

### Alertas (init §4)
- RF-16 Alerta de queda — RN-08, RN-10.
- RF-17 Alerta de mancha — RN-09, RN-10 (geometria da mancha salva).
- RF-18 Lista de alertas (severidade, data, talhão, link "ver no mapa" → abre talhão na data, centraliza na geometria do alerta).
- RF-19 Notificação simulada a cada alerta novo — RN-11.

### Interface (init §5)
- RF-20 Mapa satélite tela cheia (ESRI World Imagery) + overlay NDVI semitransparente.
- RF-21 Timeline com slider + play animando as cenas válidas em ordem cronológica.
- RF-22 Modo comparar: divisor arrastável entre duas datas.
- RF-23 Painel lateral: série temporal (Recharts, média + p10/p90) com marcadores de alertas.
- RF-24 Legenda de cores; clique no mapa mostra NDVI do pixel (ou "sem dado").
- RF-25 Seletor de data das zonas (padrão = última cena válida) — RN-07.
- RF-26 Dashboard da fazenda: card por talhão (NDVI atual, tendência ↑↓, último alerta).
- RF-27 Responsivo (≥ 360 px; painel vira bottom sheet no mobile).

### Relatório (init §6)
- RF-28 PDF por talhão gerado no worker — RN-15.

### Operação / qualidade
- RF-29 Seed: fazenda demo Uruçuí-PI, 3 talhões (1 problemático) dentro da bbox RN-14; `make demo` = seed + histórico em `fixtures`.
- RF-30 Sem auth, tenant único — RN-12.
- RF-31 README pt-BR (Mermaid, como subir, analogia NDVI), `DECISIONS.md` (D-05), `TODO.md`.
- RF-32 Lint + typecheck sem erros nos 3 apps.

## 2. Critérios de aceite

Formato: Dado / Quando / Então.

### Globais (init — critérios 1–5)
- CA-G1 Dado ambiente limpo, quando `docker compose up` + `make demo`, então http://localhost:3005 mostra a fazenda demo com overlay NDVI colorido.
- CA-G2 Dado seed processado, quando play na timeline, então anima 12 datas e o talhão problemático fica progressivamente vermelho.
- CA-G3 Dado `make demo` concluído, quando `GET /alerts`, então `total ≥ 1`.
- CA-G4 Dado máquina sem rede, quando rodar Jest, pytest e Playwright, então todos passam.
- CA-G5 Dado talhão processado, quando gerar relatório, então job `completed` e PDF existe no volume com HTTP 200 `application/pdf`.

### RF-01
- Dado payload válido, quando `POST /farms`, então 201 com fazenda.
- Dado `state` ≠ 2 letras ou `name` vazio, quando criar/editar, então 400 `VALIDATION_ERROR` pt-BR.
- Dado id inexistente, quando GET/PATCH/DELETE, então 404 `NOT_FOUND`.

### RF-02 / RF-04
- Dado Polygon válido, quando `POST /farms/:id/plots`, então 201 com `areaHa` = `ST_Area(geography)/10000`.
- Dado geometria inválida (auto-interseção, < 4 pontos, anel aberto) ou tipo ≠ Polygon, então 400 `INVALID_GEOMETRY` pt-BR.
- Dado PATCH com nova geometria, então `areaHa` recalculada.

### RF-03
- Dado GeoJSON com 1 MultiPolygon de 3 partes, quando importar, então 3 talhões criados.
- Dado arquivo não parseável (JSON/XML inválido), então 400 `INVALID_FILE`.
- Dado arquivo sem Polygon/MultiPolygon, então 400 `NO_POLYGON` ("nenhum polígono encontrado no arquivo").
- Dado alguma geometria inválida, então 400 `INVALID_GEOMETRY` e nenhum talhão criado (transação).
- Dado extensão ≠ `.geojson/.json/.kml`, então 400 `INVALID_FILE`.

### RF-06 / RF-13
- Dado talhão existente, quando `POST /plots/:id/process`, então 202 `{jobId}` e job `queued`.
- Dado job concluído, quando `GET /jobs/:id`, então `completed` com contagem de cenas válidas/descartadas.
- Dado job do mesmo talhão já `queued|running`, quando processar de novo, então 409 `JOB_IN_PROGRESS`.

### RF-07 / RF-09
- Dado raster com B04/B08 conhecidos, então NDVI = RN-01 (tolerância 1e-6).
- Dado pixel SCL ∈ {3,8,9,10}, então pixel nodata e excluído das stats.
- Dado pixel com B08+B04 = 0, então nodata.
- Dado cena válida, então salvos mean, median, p10, p90, validPct — RN-03.

### RF-08 (borda: sem cena válida)
- Dado cena com > 60% nodata no talhão, então `valid=false`, sem stats, sem PNG, sem zonas, sem alertas.
- Dado todas as cenas > 60%, então talhão sem estatística, sem alerta; UI mostra "sem cenas válidas no período".

### RF-11 (bordas: offline / STAC)
- Dado `DATA_MODE=fixtures` e talhão fora da bbox, então job `failed` com "sem dados offline para esta área" (`NO_OFFLINE_DATA`).
- Dado `DATA_MODE=auto` e STAC indisponível/timeout, então usa fixtures, loga warning, job não falha; `source="fixtures"`.
- Dado `DATA_MODE=stac` e STAC indisponível, então job `failed` `STAC_UNAVAILABLE`.

### RF-12 (borda: reprocessar)
- Dado talhão já processado, quando reprocessar, então nº de linhas `ndvi_scene`/`zone`/`alert` não muda; valores atualizados; arquivos sobrescritos; notificação não repetida para alerta já existente.

### RF-10 / RF-20 / RF-24
- Dado cena válida, então `pngUrl` responde 200 `image/png` e `bounds` cobrem o talhão.
- Dado clique em pixel válido, então popup "NDVI: 0,72"; nodata/fora do talhão → "sem dado".

### RF-14 / RF-15 / RF-25
- Dado cena válida, então 3 features (`low|medium|high`) com `areaHa`, soma ≈ área válida.
- Dado nenhuma data escolhida, então zonas da última cena válida; dado data escolhida, zonas daquela cena.
- Dado `GET .../zones?download=1`, então `Content-Disposition: attachment; filename="zonas-<talhao>-<data>.geojson"`.
- Dado data sem cena válida, então 404 `SCENE_NOT_FOUND`.

### RF-16 (borda: < 3 cenas)
- Dado < 3 cenas válidas anteriores, então nenhum alerta de queda.
- Dado média < 85% da mediana das 3 anteriores e queda entre 15–25%, então alerta `drop` `medium`; queda > 25% → `high`.
- Dado queda ≤ 15%, então sem alerta.

### RF-17
- Dado mancha contígua > 1 ha e ≤ 3 ha com NDVI < p10 histórico, então alerta `patch` `medium`; > 3 ha → `high`.
- Dado mancha ≤ 1 ha, então sem alerta.
- Dado nenhuma cena válida anterior, então sem alerta de mancha.

### RF-18 / RF-19
- Dado alertas, quando `GET /alerts?farmId=`, então lista paginada ordenada por data desc.
- Dado clique "ver no mapa", então mapa abre na data do alerta e enquadra a geometria.
- Dado alerta novo, então log estruturado `notification.simulated` e nenhum envio externo.
- Dado `POST /notifications/whatsapp`, então 202 `{simulated:true}` e log.

### RF-21 / RF-22 / RF-23 / RF-26 / RF-27
- Dado 12 cenas válidas, quando play, então avança uma data por intervalo e para no fim; slider reflete a data.
- Dado modo comparar, quando arrastar divisor, então lado esquerdo = data A, direito = data B.
- Dado gráfico, então ponto por cena válida e marcador em cada data com alerta.
- Dado dashboard, então um card por talhão com NDVI atual, seta de tendência e último alerta (ou "sem alertas").
- Dado viewport 375×812, então mapa, timeline e painel utilizáveis sem scroll horizontal.

### RF-28
- Dado talhão com cenas válidas, quando `POST /plots/:id/reports`, então 202 `{jobId}`; ao concluir, PDF contém mapa NDVI atual, zonas, gráfico, alertas e recomendações — RN-15.
- Dado talhão sem cena válida, então 422 `NO_VALID_SCENE`.

### RF-29
- Dado `make demo` executado 2×, então sem duplicar fazenda/talhões (seed idempotente por nome).

## 3. Modelo de dados (Prisma + PostGIS)

- Extensão `postgis` habilitada na migration inicial. Colunas geométricas via `Unsupported("geometry(...)")`; escrita/leitura por `$queryRaw` (`ST_GeomFromGeoJSON`, `ST_AsGeoJSON`, `ST_IsValid`).
- IDs `uuid`; `createdAt`/`updatedAt` `timestamptz` em todas.

| Tabela | Campos | Índices / constraints |
|---|---|---|
| `farm` | id, name text, municipality text, state char(2) | unique(name) (seed idempotente) |
| `plot` | id, farmId FK, name text, geom `geometry(Polygon,4326)`, areaHa numeric(12,4) | GIST(geom); CHECK `ST_IsValid(geom)`; index(farmId); FK cascade |
| `ndvi_scene` | id, plotId FK, sceneDate date, source enum(stac,fixtures), valid bool, validPct numeric(5,2), mean, median, p10, p90 (double, null se `valid=false`), pngPath, ndviPath (GeoTIFF float32, p/ pixel e p10 histórico), bounds jsonb `[[w,s],[e,n]]` | **unique(plotId, sceneDate)** (upsert RN-12 borda); index(plotId, sceneDate) |
| `zone` | id, sceneId FK, class enum(low,medium,high), geom `geometry(MultiPolygon,4326)`, areaHa numeric(12,4) | **unique(sceneId, class)**; GIST(geom); FK cascade |
| `alert` | id, plotId FK, sceneId FK, sceneDate date, type enum(drop,patch), severity enum(medium,high), value double (queda % ou área ha), geom `geometry(Geometry,4326)` null (mancha), notifiedAt timestamptz null | **unique(plotId, sceneDate, type)**; index(plotId, sceneDate desc); FK cascade |
| `job` | id (= BullMQ jobId), type enum(history,report), plotId FK, status enum(queued,running,completed,failed), errorCode text null, errorMessage text null, result jsonb null, startedAt, finishedAt | index(plotId, status) |
| `report` | id, plotId FK, jobId FK, pdfPath, generatedAt | index(plotId, generatedAt desc) |

- Mancha: no MVP, 1 alerta `patch` por talhão+data (a maior mancha; `value` = área). Ver Perguntas em aberto.
- `areaHa` = `ST_Area(geom::geography)/10000` gravado no mesmo statement do insert/update (RN-04).
- Persistência do resultado de um job (cenas + zonas + alertas) em **uma transação**.
- Notificação (RF-19) dispara só quando o upsert do alerta foi insert (`notifiedAt` nulo).

## 4. Contratos de API

### Padrões
- Base: `http://localhost:3001/api/v1`. JSON; datas `YYYY-MM-DD`; geometrias GeoJSON (EPSG:4326).
- Paginação (listas abertas): `?page=1&pageSize=20` (máx 100) → `{ data: [...], meta: { page, pageSize, total } }`.
- Erro: `{ statusCode, code, message, details? }` — `message` em pt-BR; `details` = lista de campos no 400 de validação.
- Validação por DTO (class-validator); resposta por DTO, nunca entidade Prisma.
- OpenAPI gerado em `/api/docs` (Swagger).

### REST (NestJS)

| Método | Rota | Request | Response | Erros |
|---|---|---|---|---|
| GET | /health | — | `{status:"ok"}` | — |
| GET | /farms | page, pageSize | paginado `Farm[]` | — |
| POST | /farms | `{name, municipality, state}` | 201 `Farm` | 400, 409 `FARM_EXISTS` |
| GET | /farms/:id | — | `Farm` + `plotCount` | 404 |
| PATCH | /farms/:id | parcial de POST | `Farm` | 400, 404 |
| DELETE | /farms/:id | — | 204 | 404 |
| GET | /farms/:id/dashboard | — | `{farm, plots:[{id,name,areaHa,currentNdvi\|null,trend:"up"\|"down"\|"flat"\|null,lastAlert\|null}]}` | 404 |
| GET | /farms/:id/plots | — | `Feature[]` (properties: id, name, areaHa) — sem paginação (bounded por fazenda) | 404 |
| POST | /farms/:id/plots | `{name, geometry: Polygon}` | 201 `Feature` | 400 `INVALID_GEOMETRY`, 404 |
| POST | /farms/:id/plots/import | multipart `file` (.geojson/.json/.kml, ≤ 5 MB) | 201 `{created: Feature[]}` | 400 `INVALID_FILE`/`NO_POLYGON`/`INVALID_GEOMETRY`, 404 |
| GET | /plots/:id | — | `Feature` | 404 |
| PATCH | /plots/:id | `{name?, geometry?}` | `Feature` | 400, 404 |
| DELETE | /plots/:id | — | 204 | 404 |
| POST | /plots/:id/process | — | 202 `{jobId}` | 404, 409 `JOB_IN_PROGRESS` |
| POST | /farms/:id/process | — | 202 `{jobIds: []}` | 404 |
| GET | /jobs/:id | — | `{id,type,plotId,status,errorCode,errorMessage,result,startedAt,finishedAt}` | 404 |
| GET | /plots/:id/scenes | `?valid=true` | `[{date,valid,validPct,mean,median,p10,p90,pngUrl,bounds,source}]` asc — sem paginação (≤ 6 meses, RN-06) | 404 |
| GET | /plots/:id/zones | `?date=YYYY-MM-DD` (padrão última válida), `?download=1` | `FeatureCollection` (properties: class, areaHa, date) | 404 `SCENE_NOT_FOUND` |
| GET | /plots/:id/pixel | `?date&lng&lat` | `{ndvi: number\|null}` | 400, 404 |
| GET | /alerts | farmId?, plotId?, severity?, type?, page, pageSize | paginado `[{id,plotId,plotName,date,type,severity,value,geometry\|null}]` desc | 400 |
| POST | /notifications/whatsapp | `{alertId, phone?}` | 202 `{simulated:true}` | 404 |
| POST | /plots/:id/reports | — | 202 `{jobId}` | 404, 422 `NO_VALID_SCENE` |
| GET | /plots/:id/reports/latest | — | `{id, generatedAt, pdfUrl}` | 404 |
| GET | /files/* | — | arquivo estático do volume (png, geojson, pdf) | 404 |

### API → Worker (HTTP, FastAPI, `WORKER_URL`)
- Worker stateless: não acessa Postgres; lê/grava só em `DATA_DIR`.

| Método | Rota | Request | Response | Erros |
|---|---|---|---|---|
| GET | /health | — | `{status, dataMode}` | — |
| POST | /process | `{plotId, plotName, geometry, dateFrom, dateTo}` | `{source, scenes:[{date, valid, validPct, stats:{mean,median,p10,p90}\|null, pngPath, ndviPath, bounds, zones: FeatureCollection\|null, alerts:[{type,severity,value,geometry\|null}]}]}` em ordem cronológica | 422 `NO_OFFLINE_DATA`, 503 `STAC_UNAVAILABLE`, 400 |
| POST | /pixel | `{ndviPath, lng, lat}` | `{ndvi\|null}` | 404 |
| POST | /report | `{plot:{id,name,areaHa,geometry}, scenes:[stats], alerts:[...], latest:{pngPath,bounds,zonesPath}}` | `{pdfPath}` | 400, 500 |

- Erros do worker no formato `{code, message}` (pt-BR); API grava em `job.errorCode/errorMessage`.
- Alertas (RN-08/09/10) calculados no worker sobre as cenas válidas anteriores dentro da janela processada (pytest cobre).
- Timeout HTTP: `WORKER_TIMEOUT_MS`.

### BullMQ
- Fila `agrosat` (Redis); producer e consumer na API (D-01).
- Jobs:
  - `history` — data `{plotId}`; janela = hoje − 6 meses → hoje (RN-06); `jobId` = uuid gravado em `job`.
  - `report` — data `{plotId}`.
- `attempts: 3`, backoff exponencial 5 s; erro de domínio (`NO_OFFLINE_DATA`, `NO_VALID_SCENE`) → `UnrecoverableError` (sem retry).
- Concorrência 2; `removeOnComplete: 100`.
- Ciclo: `queued` → `running` (consumer) → chama worker → transação de upsert → `completed` | `failed`.

## 5. Erros e permissões
- Sem autenticação/autorização; todas as rotas públicas, tenant único (RN-12). CORS liberado para `WEB_ORIGIN`.
- Códigos: `VALIDATION_ERROR` 400, `INVALID_FILE` 400, `NO_POLYGON` 400, `INVALID_GEOMETRY` 400, `NOT_FOUND` 404, `SCENE_NOT_FOUND` 404, `FARM_EXISTS` 409, `JOB_IN_PROGRESS` 409, `NO_VALID_SCENE` 422, `NO_OFFLINE_DATA` (job), `STAC_UNAVAILABLE` (job), `INTERNAL` 500.
- Filtro global de exceção na API garante o formato padrão; stack trace só em log.
- Upload limitado a 5 MB e extensões permitidas; caminhos de `/files/*` restritos a `DATA_DIR` (sem `..`).

## 6. Estrutura, portas, env, volume

```
agrosat/
  api/            NestJS (src/{farms,plots,scenes,zones,alerts,jobs,reports,notifications,files}, prisma/, test/)
  worker/         FastAPI (app/{ndvi,mask,zones,alerts,report,sources/{stac,fixtures}}, fixtures/, scripts/gen_fixtures.py, tests/)
  web/            Next.js 14 App Router (app/, components/map, components/timeline, components/charts)
  e2e/            Playwright
  docker-compose.yml  Makefile  README.md  DECISIONS.md  TODO.md
```

| Serviço | Porta host |
|---|---|
| web | 3005 |
| api | 3001 |
| worker | 8000 |
| postgres (postgis/postgis:16) | 5432 |
| redis | 6379 |

- Volume `agrosat-data` montado em `/data` em api, worker e web (D-02):
  - `/data/plots/{plotId}/{date}/ndvi.tif | ndvi.png | zones.geojson`
  - `/data/reports/{plotId}/{timestamp}.pdf`
- Variáveis:
  - api: `PORT=3001`, `DATABASE_URL`, `REDIS_URL`, `WORKER_URL=http://worker:8000`, `WORKER_TIMEOUT_MS`, `DATA_DIR=/data`, `WEB_ORIGIN=http://localhost:3005`, `PUBLIC_FILES_URL`
  - worker: `DATA_MODE=auto|stac|fixtures` (RN-13), `STAC_URL=https://earth-search.aws.element84.com/v1`, `STAC_COLLECTION=sentinel-2-l2a`, `STAC_TIMEOUT_S`, `DATA_DIR=/data`, `FIXTURES_DIR=/app/fixtures`
  - web: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`
- `.env.example` na raiz; `make demo` sobe com `DATA_MODE=fixtures` (RN-13).
- Makefile: `demo` (migrate + seed + `POST /farms/:id/process` + aguarda jobs), `test`, `lint`, `e2e`.

## 7. Estratégia de testes (100% offline — CA-G4)
- **Jest (api)**: unit de services (upsert idempotente, parse GeoJSON/KML, explosão de MultiPolygon, regras de 409/422, filtro de erro); integração com Postgres/PostGIS via docker compose (área ha, CHECK de validade, unique). Worker mockado via HTTP stub.
- **pytest (worker)**: NDVI (RN-01), máscara SCL e divisão por zero, descarte > 60% (RN-02), stats (RN-03), zonas por quantis e áreas (RN-07), alerta de queda incl. < 3 cenas (RN-08/10), mancha incl. ≤ 1 ha e sem histórico (RN-09/10), fallback `auto` sem rede (RN-13), fora da bbox (RN-14), PDF gerado (RN-15). Rede bloqueada (fixture `socket` desabilitado).
- **Playwright (e2e/)**: contra `docker compose` em fixtures (D-04): criar fazenda → desenhar talhão (dentro da bbox) → processar → timeline anima → alerta visível na lista (talhão problemático do seed) → "ver no mapa"; + baixar PDF; + viewport mobile 375 px.
- **Lint/typecheck**: ESLint + `tsc --noEmit` (api, web); ruff + mypy (worker). Rodam no `make test`.

## 8. Decisões sobre perguntas em aberto (padrões propostos aceitos pelo usuário; "Proposta" = decisão)
1. Regras de recomendação do PDF (RN-15): só há o exemplo. Proposta: texto por alerta — mancha → "investigar porção <direção cardinal da mancha em relação ao centroide> do <talhão>"; queda → "verificar <talhão>: queda de X% no NDVI". Confirmar.
2. Tendência ↑↓ do card (RF-26): critério não definido. Proposta: média atual vs. média da cena válida anterior, `flat` se |Δ| < 0,02.
3. Mancha (RN-09): várias manchas na mesma cena → 1 alerta (maior) ou 1 por mancha? Proposta: 1 por cena (maior), por causa da unique de upsert.
4. Mancha (RN-09): número mínimo de cenas anteriores para o p10 histórico? Proposta: ≥ 1 cena válida anterior.
5. Upload com mistura de Polygon e outras geometrias (Point/LineString): ignorar as não-poligonais ou rejeitar? Proposta: ignorar e retornar `ignored: n`.
6. Janela de alertas: cenas anteriores à janela de 6 meses contam para RN-08/RN-09 em reprocessamentos futuros? Proposta: não no MVP (janela única).
7. Payload do endpoint WhatsApp (RN-11): telefone por fazenda ou informado na chamada? Proposta: opcional na chamada, sem persistir.
