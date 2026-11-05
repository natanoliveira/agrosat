# AgroSat MVP — Tarefas

Fontes: `plan.md` (etapas E0–E9, ADRs), `spec.md` (RF/CA), `analysis.md` (RN/D).
Legenda: `[P]` = pode rodar em paralelo com as outras `[P]` da mesma etapa (depois que as dependências terminam). Pronto = comando que precisa passar.

## Decisões assumidas (plan.md §8)
- P1: em `DATA_MODE=fixtures` a janela de 6 meses é ignorada; devolve sempre as 12 datas fixas.
- P2: o reprocessamento remove zonas/alertas que deixaram de existir, na mesma transação (estado = último processamento).
- P3: o PATCH de geometria mantém cenas/zonas/alertas e marca `plot.needsReprocess=true`; a UI avisa "geometria alterada, reprocesse". O flag volta a `false` quando um job `history` termina.
- P4: 12 cenas a cada 15 dias; a data-base é uma constante em `gen_fixtures.py`.

---

## E0 — Infra base
- [x] **T-01** compose com postgres + redis, volume e env
  - Cobre: D-02, spec §6
  - Arquivos: `docker-compose.yml`, `.env.example`, `.gitignore`
  - Pronto: `docker compose up -d --wait postgres redis` com os dois healthy; `.env` listado no `.gitignore`
  - Depende: —
- [x] **T-02** Makefile esqueleto + DECISIONS.md inicial (ADR-01..07 + P1–P4)
  - Cobre: D-05, RF-31 (parcial)
  - Arquivos: `Makefile`, `DECISIONS.md`
  - Pronto: `make -n up demo test lint e2e fixtures audit` sem erro
  - Depende: —

## E1 — Worker núcleo (funções puras)
- [x] **T-03** scaffold do pytest com bloqueio de rede
  - Cobre: CA-G4, ADR-05
  - Arquivos: `worker/pyproject.toml`, `worker/tests/conftest.py`
  - Pronto: `cd worker && pytest && ruff check . && mypy app`; teste prova que `socket.socket` levanta erro
  - Depende: T-01
- [x] **T-04** [P] NDVI + máscara SCL + descarte por cobertura acima de 60%
  - Cobre: RF-07, RF-08, RN-01, RN-02
  - Arquivos: `worker/app/ndvi.py`, `worker/app/mask.py`, `worker/tests/test_ndvi_mask.py`
  - Pronto: `pytest tests/test_ndvi_mask.py` (tolerância 1e-6, SCL {3,8,9,10}, B08+B04=0 vira nodata, >60% vira `valid=false`)
  - Depende: T-03
- [x] **T-05** [P] estatísticas
  - Cobre: RF-09, RN-03
  - Arquivos: `worker/app/stats.py`, `worker/tests/test_stats.py`
  - Pronto: `pytest tests/test_stats.py` (mean/median/p10/p90/validPct)
  - Depende: T-03
- [x] **T-06** [P] PNG com rampa de cores + bounds
  - Cobre: RF-10
  - Arquivos: `worker/app/render.py`, `worker/tests/test_render.py`
  - Pronto: `pytest tests/test_render.py` (nodata com alpha 0, faixa -0.2..0.9, bounds `[[w,s],[e,n]]`)
  - Depende: T-03
- [x] **T-07** [P] zonas por quantis 33/66, vetorizadas, com área em ha
  - Cobre: RF-14, RN-07
  - Arquivos: `worker/app/zones.py`, `worker/tests/test_zones.py`
  - Pronto: `pytest tests/test_zones.py` (3 classes; soma das áreas ≈ área válida)
  - Depende: T-03
- [x] **T-08** [P] alertas de queda e de mancha + severidade
  - Cobre: RF-16, RF-17, RN-08, RN-09, RN-10, spec §8.3/§8.4/§8.6
  - Arquivos: `worker/app/alerts.py`, `worker/tests/test_alerts.py`
  - Pronto: `pytest tests/test_alerts.py` (menos de 3 cenas: sem drop; 15–25% medium; >25% high; mancha ≤1 ha: nada; >3 ha high; sem histórico: sem patch)
  - Depende: T-03
- [x] **T-09** [P] gerador de fixtures determinístico + talhões demo
  - Cobre: RN-14, ADR-04, P4
  - Arquivos: `worker/scripts/gen_fixtures.py`, `worker/fixtures/demo-plots.geojson`, `worker/tests/test_fixtures.py`
  - Pronto: `make fixtures && pytest tests/test_fixtures.py` (checksum estável, 12 datas espaçadas de 15 dias, bbox certa)
  - Depende: T-03
- [x] **T-10** pipeline cronológico
  - Cobre: RF-07..RF-14, RF-16, RF-17
  - Arquivos: `worker/app/pipeline.py`, `worker/tests/test_pipeline.py`
  - Pronto: `pytest tests/test_pipeline.py` (o talhão problemático gera `drop` e `patch`; duas execuções dão a mesma saída)
  - Depende: T-04..T-09

## E2 — API base
- [x] **T-11** scaffold NestJS (prefixo `/api/v1`, Swagger, ValidationPipe, CORS `WEB_ORIGIN`, `/health`, sem auth)
  - Cobre: RF-30, RN-12, spec §4 "Padrões"
  - Arquivos: `api/package.json`, `api/src/main.ts`, `api/src/prisma/prisma.service.ts`
  - Pronto: `cd api && npm run build && npm run lint && npx tsc --noEmit`
  - Depende: T-01
- [x] **T-12** schema Prisma + migration `0001_init` (postgis, CHECK `ST_IsValid`, uniques, GIST, `plot.needsReprocess`)
  - Cobre: RF-04, RF-12, spec §3, plan §3, P3
  - Arquivos: `api/prisma/schema.prisma`, `api/prisma/migrations/0001_init/migration.sql`
  - Pronto: `npx prisma migrate deploy` sem erro e `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` (sem drift)
  - Depende: T-11
- [x] **T-13** [P] filtro de erro, códigos de erro, DTO de paginação
  - Cobre: spec §4/§5
  - Arquivos: `api/src/common/http-exception.filter.ts`, `api/src/common/errors.ts`, `api/src/common/pagination.dto.ts`
  - Pronto: `npm test -- common` (formato `{statusCode,code,message,details?}`, stack só no log, `pageSize` máx. 100)
  - Depende: T-11
- [x] **T-14** [P] validação GeoJSON + parse KML + explosão de MultiPolygon
  - Cobre: RF-02, RF-03, RN-05, spec §8.5
  - Arquivos: `api/src/common/geo.ts`, `api/test/geo.spec.ts`
  - Pronto: `npm test -- geo` (anel aberto, menos de 4 pontos, tipo errado, MultiPolygon com 3 partes vira 3, `ignored` contado)
  - Depende: T-11
- [x] **T-15** módulo farms (CRUD, 409 `FARM_EXISTS`)
  - Cobre: RF-01
  - Arquivos: `api/src/farms/farms.controller.ts`, `api/src/farms/farms.service.ts`, `api/src/farms/dto.ts`
  - Pronto: `npm test -- farms` (201/400/404/409)
  - Depende: T-12, T-13
- [x] **T-16** repositório raw de plots + CRUD (área calculada no SQL, PATCH de geometria liga `needsReprocess`)
  - Cobre: RF-02, RF-04, RF-05, RN-04, P3
  - Arquivos: `api/src/plots/plots.repository.ts`, `api/src/plots/plots.service.ts`, `api/src/plots/plots.controller.ts`
  - Pronto: `npm test -- plots` (`INVALID_GEOMETRY` antes do insert; `areaHa` recalculada no PATCH; `needsReprocess=true`)
  - Depende: T-12, T-13, T-14
- [x] **T-17** import multipart (≤ 5 MB, extensões aceitas, transação)
  - Cobre: RF-03, RN-05
  - Arquivos: `api/src/plots/plots-import.controller.ts`, `api/test/plots-import.spec.ts`
  - Pronto: `npm test -- plots-import` (`INVALID_FILE`, `NO_POLYGON`, geometria inválida não cria nenhum talhão, `{created, ignored}`)
  - Depende: T-16
- [x] **T-18** [P] `/files/*` com bloqueio de `..` + remoção da pasta do talhão após o commit do DELETE
  - Cobre: RF-05, ADR-02, spec §5
  - Arquivos: `api/src/files/files.controller.ts`, `api/src/files/files.service.ts`, `api/test/files.spec.ts`
  - Pronto: `npm test -- files` (path traversal dá 404; Content-Type certo; pasta some depois do delete)
  - Depende: T-16
- [x] **T-19** integração com PostGIS (área em ha, CHECK, uniques, cascata)
  - Cobre: RF-04, RF-05, RF-12
  - Arquivos: `api/test/integration/db.int-spec.ts`, `api/jest.int.config.ts`
  - Pronto: `npm run test:int` com o postgres do compose
  - Depende: T-15, T-16

## E3 — Worker HTTP
- [x] **T-20** fontes: contrato, fixtures (bbox, ignora janela) e seleção por `DATA_MODE` com fallback `auto`
  - Cobre: RF-11, RN-13, RN-14, P1
  - Arquivos: `worker/app/sources/base.py`, `worker/app/sources/fixtures.py`, `worker/app/sources/__init__.py`
  - Pronto: `pytest tests/test_sources.py` (fora da bbox dá `NO_OFFLINE_DATA`; `auto` sem rede usa `source="fixtures"` e loga warning; fixtures devolve as 12 datas com qualquer janela)
  - Depende: T-09
- [x] **T-21** [P] fonte STAC (filtro de nuvem, leitura em janela do COG)
  - Cobre: RF-11, RN-13
  - Arquivos: `worker/app/sources/stac.py`, `worker/tests/test_stac.py`
  - Pronto: `pytest tests/test_stac.py` com cliente mockado (`stac` indisponível dá `STAC_UNAVAILABLE`)
  - Depende: T-20
- [x] **T-22** rotas `/health`, `/process`, `/pixel` + erros `{code,message}` em pt-BR
  - Cobre: RF-06..RF-14, RF-24, spec §4 API→Worker
  - Arquivos: `worker/app/main.py`, `worker/app/errors.py`, `worker/tests/test_api.py`
  - Pronto: `pytest tests/test_api.py` (TestClient; resposta segue o contrato; pixel fora do talhão dá `null`)
  - Depende: T-10, T-20
- [x] **T-23** Dockerfile do worker (gera fixtures no build) + serviço no compose
  - Cobre: ADR-04, risco GDAL arm64/amd64
  - Arquivos: `worker/Dockerfile`, `docker-compose.yml`
  - Pronto: `docker compose build worker && docker compose up -d --wait worker && curl -f localhost:8000/health`
  - Depende: T-22

## E4 — API jobs e leitura
- [x] **T-24** BullMQ (producer/consumer), `worker.client`, 409 com `FOR UPDATE`, retry e `UnrecoverableError`
  - Cobre: RF-06, RF-13, ADR-01
  - Arquivos: `api/src/jobs/jobs.service.ts`, `api/src/jobs/jobs.processor.ts`, `api/src/jobs/worker.client.ts`
  - Pronto: `npm test -- jobs` com worker stub (202 `{jobId}`; 409 `JOB_IN_PROGRESS`; `failed` só na última tentativa; `GET /jobs/:id` com `result`)
  - Depende: T-16 (stub até T-22)
- [x] **T-25** persistência transacional do resultado (upsert de cenas/zonas/alertas, remove o que sumiu, zera `needsReprocess`)
  - Cobre: RF-12, RF-14, RF-16, RF-17, P2, P3
  - Arquivos: `api/src/jobs/result.persister.ts`, `api/src/zones/zones.repository.ts`, `api/src/alerts/alerts.repository.ts`
  - Pronto: `npm run test:int -- persister` (rodar 2× não muda a contagem de linhas; alerta ausente na 2ª execução é removido; `inserted` só no primeiro insert)
  - Depende: T-24, T-19
- [x] **T-26** notificação simulada (log `notification.simulated` + `POST /notifications/whatsapp`)
  - Cobre: RF-19, RN-11, spec §8.7
  - Arquivos: `api/src/notifications/notifications.service.ts`, `api/src/notifications/notifications.controller.ts`
  - Pronto: `npm test -- notifications` (202 `{simulated:true}`; dispara só quando `notifiedAt` é nulo; nada sai da máquina)
  - Depende: T-25
- [x] **T-27** [P] cenas + pixel
  - Cobre: RF-09, RF-10, RF-24
  - Arquivos: `api/src/scenes/scenes.controller.ts`, `api/src/scenes/scenes.service.ts`
  - Pronto: `npm test -- scenes` (ordem asc, `?valid=true`, `pngUrl` com `PUBLIC_FILES_URL`, pixel repassado ao worker)
  - Depende: T-25
- [x] **T-28** [P] zonas + download
  - Cobre: RF-14, RF-15, RF-25
  - Arquivos: `api/src/zones/zones.controller.ts`, `api/src/zones/zones.service.ts`
  - Pronto: `npm test -- zones` (padrão = última cena válida; `SCENE_NOT_FOUND`; header `Content-Disposition` certo)
  - Depende: T-25
- [x] **T-29** [P] lista de alertas paginada
  - Cobre: RF-18
  - Arquivos: `api/src/alerts/alerts.controller.ts`, `api/src/alerts/alerts.service.ts`
  - Pronto: `npm test -- alerts` (filtros, ordem desc, `meta.total`)
  - Depende: T-25
- [x] **T-30** [P] dashboard da fazenda + `POST /farms/:id/process`
  - Cobre: RF-26, RF-06, spec §8.2, P3
  - Arquivos: `api/src/farms/dashboard.service.ts`, `api/src/farms/farms.controller.ts`
  - Pronto: `npm test -- dashboard` (`trend` flat quando |Δ| < 0,02; `null` sem cenas; `needsReprocess` no card; `jobIds[]`)
  - Depende: T-25
- [x] **T-31** Dockerfile da API (`migrate deploy` no entrypoint) + serviço no compose
  - Cobre: spec §6
  - Arquivos: `api/Dockerfile`, `docker-compose.yml`
  - Pronto: `docker compose up -d --wait api && curl -f localhost:3001/api/v1/health`
  - Depende: T-24, T-23

## E5a — Web base
- [x] **T-32** scaffold Next 14 + Tailwind + cliente da API + formatação pt-BR
  - Cobre: RF-24 (formato "0,72"), RF-32
  - Arquivos: `web/lib/api.ts`, `web/lib/api-types.ts`, `web/lib/format.ts`
  - Pronto: `cd web && npm run build && npm run lint && npx tsc --noEmit`
  - Depende: T-11
- [x] **T-33** MapView ESRI (`ssr:false`, `data-map-ready`, URL do basemap por env) + página do mapa
  - Cobre: RF-20
  - Arquivos: `web/components/map/MapView.tsx`, `web/app/farms/[id]/map/page.tsx`
  - Pronto: `npm run build`; validar a página no dev server (agent-browser)
  - Depende: T-32
- [x] **T-34** [P] desenhar talhão + importar arquivo
  - Cobre: RF-02, RF-03
  - Arquivos: `web/components/map/DrawControl.tsx`, `web/components/map/ImportButton.tsx`
  - Pronto: `npm run build`; criar talhão desenhado e importado contra a API de E2 (erros aparecem em pt-BR)
  - Depende: T-33, T-17
- [ ] **T-35** [P] lista e CRUD de fazendas
  - Cobre: RF-01
  - Arquivos: `web/app/page.tsx`, `web/components/FarmForm.tsx`
  - Pronto: `npm run build`; criar, editar e excluir no dev server
  - Depende: T-32, T-15

## E5b — Web análise
- [x] **T-36** overlay NDVI + timeline com play (pré-carregar PNGs, `data-current-date`, aviso "sem cenas válidas no período" e "geometria alterada, reprocesse")
  - Cobre: RF-20, RF-21, RF-08, P3
  - Arquivos: `web/components/timeline/Timeline.tsx`, `web/lib/geo.ts`, `web/components/map/MapView.tsx`
  - Pronto: `npm run build`; o play avança e para na última data (dev server)
  - Depende: T-33, T-27
- [x] **T-37** [P] modo comparar
  - Cobre: RF-22, ADR-07
  - Arquivos: `web/components/map/CompareMap.tsx`
  - Pronto: `npm run build`; data A à esquerda e B à direita ao arrastar
  - Depende: T-36
- [x] **T-38** [P] gráfico + painel lateral / bottom sheet
  - Cobre: RF-23, RF-27
  - Arquivos: `web/components/charts/NdviChart.tsx`, `web/components/panel/SidePanel.tsx`
  - Pronto: `npm run build`; marcadores de alerta; em 375×812 sem scroll horizontal
  - Depende: T-36, T-29
- [x] **T-39** [P] legenda + popup de pixel
  - Cobre: RF-24
  - Arquivos: `web/components/map/PixelPopup.tsx`, `web/components/map/Legend.tsx`
  - Pronto: `npm run build`; mostra "NDVI: 0,72" ou "sem dado"
  - Depende: T-36
- [x] **T-40** [P] camada de zonas + seletor de data + download
  - Cobre: RF-25, RF-15
  - Arquivos: `web/components/map/ZonesLayer.tsx`
  - Pronto: `npm run build`; padrão = última cena válida; baixa o `.geojson`
  - Depende: T-36, T-28
- [x] **T-41** [P] página de alertas + "ver no mapa"
  - Cobre: RF-18
  - Arquivos: `web/app/alerts/page.tsx`
  - Pronto: `npm run build`; o link abre na data e enquadra a geometria
  - Depende: T-36, T-29
- [x] **T-42** [P] dashboard com cards
  - Cobre: RF-26, P3
  - Arquivos: `web/app/farms/[id]/page.tsx`, `web/components/PlotCard.tsx`
  - Pronto: `npm run build`; seta de tendência, "sem alertas" e selo "reprocesse"
  - Depende: T-32, T-30
- [x] **T-43** Dockerfile do web + serviço no compose
  - Cobre: CA-G1
  - Arquivos: `web/Dockerfile`, `docker-compose.yml`
  - Pronto: `docker compose up -d --wait web && curl -f localhost:3005`
  - Depende: T-36

## E6 — Relatório PDF
- [x] **T-44** PDF no worker (matplotlib + reportlab, recomendações §8.1) + rota `/report`
  - Cobre: RF-28, RN-15, spec §8.1
  - Arquivos: `worker/app/report.py`, `worker/app/main.py`, `worker/tests/test_report.py`
  - Pronto: `pytest tests/test_report.py` (PDF válido; texto "investigar porção <direção>")
  - Depende: T-22
- [x] **T-45** módulo reports na API (job `report`, 422 `NO_VALID_SCENE`, `latest`)
  - Cobre: RF-28, CA-G5
  - Arquivos: `api/src/reports/reports.controller.ts`, `api/src/reports/reports.service.ts`
  - Pronto: `npm test -- reports` (202; 422 sem cena válida; `pdfUrl` responde `application/pdf`)
  - Depende: T-24, T-44
- [x] **T-46** botão "gerar relatório" no web
  - Cobre: RF-28
  - Arquivos: `web/components/panel/ReportButton.tsx`
  - Pronto: `npm run build`; baixa o PDF depois do polling do job
  - Depende: T-45, T-38

## E7 — Seed e demo
- [x] **T-47** seed idempotente por nome (lê `demo-plots.geojson`)
  - Cobre: RF-29
  - Arquivos: `api/prisma/seed.ts`
  - Pronto: `npx prisma db seed` 2× sem duplicar (contagem de farm/plot igual)
  - Depende: T-16, T-09
- [x] **T-48** `make demo` ponta a ponta (migrate + seed + processa + espera os jobs)
  - Cobre: CA-G1, CA-G2, CA-G3, CA-G5, RF-29
  - Arquivos: `Makefile`, `scripts/wait-jobs.sh`
  - Pronto: `docker compose up -d --wait && make demo && curl -s localhost:3001/api/v1/alerts | jq '.meta.total >= 1'` dá `true`; repetir `make demo` não duplica nada
  - Depende: T-47, T-31, T-43, T-45

## E8 — E2E
- [x] **T-49** config do Playwright (swiftshader, intercepta tiles) + fluxo principal
  - Cobre: CA-G4, D-04
  - Arquivos: `e2e/playwright.config.ts`, `e2e/fixtures/blank-tile.png`, `e2e/tests/main-flow.spec.ts`
  - Pronto: `make e2e` (criar fazenda, desenhar, processar, timeline, alerta, "ver no mapa"), rodando sem rede
  - Depende: T-48
- [x] **T-50** [P] e2e do PDF + mobile 375 px
  - Cobre: RF-27, RF-28, CA-G4
  - Arquivos: `e2e/tests/report.spec.ts`, `e2e/tests/mobile.spec.ts`
  - Pronto: `make e2e`
  - Depende: T-49

## E9 — Docs e qualidade
- [ ] **T-51** [P] README pt-BR (Mermaid, como subir, analogia NDVI, nota sobre basemap offline)
  - Cobre: RF-31
  - Arquivos: `README.md`
  - Pronto: os comandos do README rodam do zero (`docker compose up` + `make demo`)
  - Depende: T-48
- [ ] **T-52** [P] TODO.md + DECISIONS.md final
  - Cobre: RF-31, D-05
  - Arquivos: `TODO.md`, `DECISIONS.md`
  - Pronto: cada ADR do plan §4 e cada P1–P4 aparece no DECISIONS.md
  - Depende: T-48
- [x] **T-53** `make test` e `make lint` verdes nos 3 apps
  - Cobre: RF-32, CA-G4
  - Arquivos: `Makefile` (+ correções pontuais)
  - Pronto: `make lint && make test` com exit 0, rodando sem rede
  - Depende: T-49

## E10 — Auditoria e LGPD básica
Dados pessoais: telefone/WhatsApp, nome da fazenda e localização (município/UF e geometria).
- [x] **T-54** telefone nunca é persistido nem logado (redact no logger; o log só mostra `phone: "***"`)
  - Cobre: RF-19, RN-11, spec §8.7
  - Arquivos: `api/src/notifications/notifications.service.ts`, `api/src/main.ts`, `api/test/notifications-privacy.spec.ts`
  - Pronto: `npm test -- notifications-privacy` (o log capturado não contém os dígitos; nenhuma coluna `phone` no schema)
  - Depende: T-26
- [x] **T-55** DELETE de fazenda apaga em cascata no banco e no volume (pastas de todos os talhões + PDFs), depois do commit
  - Cobre: RF-01, RF-05, retenção/exclusão
  - Arquivos: `api/src/farms/farms.service.ts`, `api/test/integration/farm-delete.int-spec.ts`
  - Pronto: `npm run test:int -- farm-delete` (zero linhas filhas; `/data/plots/{id}` e `/data/reports/{id}` removidos)
  - Depende: T-15, T-18, T-45
- [ ] **T-56** headers de segurança (helmet), CORS só `WEB_ORIGIN`, rate limit (throttler; limite alto, para não quebrar demo/e2e), worker sem porta pública
  - Cobre: spec §5
  - Arquivos: `api/src/main.ts`, `api/src/app.module.ts`, `docker-compose.yml`
  - Pronto: `npm test -- security` (outra origem não recebe header CORS; estourar o limite dá 429); `make e2e` continua verde
  - Depende: T-31, T-49
- [x] **T-57** [P] aviso de privacidade no web (quais dados, para quê, como excluir; telefone não é guardado)
  - Cobre: LGPD (transparência)
  - Arquivos: `web/app/privacidade/page.tsx`, `web/components/PrivacyNotice.tsx`
  - Pronto: `npm run build`; link visível no rodapé
  - Depende: T-32
- [x] **T-58** [P] checagem de dependências
  - Cobre: auditoria
  - Arquivos: `Makefile` (alvo `audit`)
  - Pronto: `make audit` (`npm audit --audit-level=high` em api/web/e2e + `pip-audit` no worker) sem vulnerabilidade alta
  - Depende: T-53
- [x] **T-59** [P] segredos só em env (API e worker falham no boot se faltar variável) + política de retenção no DECISIONS (ADR-08)
  - Cobre: spec §6, D-05
  - Arquivos: `api/src/config.ts`, `worker/app/config.py`, `DECISIONS.md`
  - Pronto: `git grep -nE "postgres(ql)?://[^$]*:[^$]*@" -- ':!.env.example'` vazio; subir sem `DATABASE_URL` falha com mensagem clara
  - Depende: T-11, T-22

---

## Checagem de cobertura

| Req | Tarefas |
|---|---|
| RF-01 | T-15, T-35, T-55 |
| RF-02 | T-14, T-16, T-34 |
| RF-03 | T-14, T-17, T-34 |
| RF-04 | T-12, T-16, T-19 |
| RF-05 | T-16, T-18, T-19 |
| RF-06 | T-22, T-24, T-30 |
| RF-07 | T-04, T-10 |
| RF-08 | T-04, T-10, T-36 |
| RF-09 | T-05, T-27 |
| RF-10 | T-06, T-27, T-36 |
| RF-11 | T-20, T-21 |
| RF-12 | T-10, T-25, T-19 |
| RF-13 | T-24 |
| RF-14 | T-07, T-25, T-28 |
| RF-15 | T-28, T-40 |
| RF-16 | T-08, T-10, T-25 |
| RF-17 | T-08, T-10, T-25 |
| RF-18 | T-29, T-41 |
| RF-19 | T-26, T-54 |
| RF-20 | T-33, T-36 |
| RF-21 | T-36 |
| RF-22 | T-37 |
| RF-23 | T-38 |
| RF-24 | T-22, T-27, T-32, T-39 |
| RF-25 | T-28, T-40 |
| RF-26 | T-30, T-42 |
| RF-27 | T-38, T-50 |
| RF-28 | T-44, T-45, T-46, T-50 |
| RF-29 | T-47, T-48 |
| RF-30 | T-11 |
| RF-31 | T-02, T-51, T-52 |
| RF-32 | T-32, T-53 |
| RN-01 | T-04 |
| RN-02 | T-04 |
| RN-03 | T-05 |
| RN-04 | T-12, T-16 |
| RN-05 | T-14, T-17 |
| RN-06 | T-24 (janela no job), T-20 (P1: ignorada em fixtures) |
| RN-07 | T-07, T-28, T-40 |
| RN-08 | T-08 |
| RN-09 | T-08 |
| RN-10 | T-08 |
| RN-11 | T-26, T-54 |
| RN-12 | T-11 |
| RN-13 | T-20, T-21 |
| RN-14 | T-09, T-20 |
| RN-15 | T-44 |
| CA-G1..G5 | T-48 (G1/G2/G3/G5), T-49/T-53 (G4) |

### Lacunas
- Nenhum RF/RN ficou sem tarefa.
- LGPD, fora do MVP: não há endpoint de exportação/portabilidade dos dados do titular (os GETs já devolvem tudo) nem log de auditoria de quem apagou o quê, porque não há auth (RN-12). Fica registrado no `TODO.md` (T-52).
- Risco: o rate limit de T-56 pode derrubar `make demo`/e2e se o limite ficar baixo. O critério de pronto de T-56 exige `make e2e` verde.
