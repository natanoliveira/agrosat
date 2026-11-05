# Fluxos e regras do AgroSat

Gerado a partir de `docs/specs/agrosat-mvp` (RN-01..RN-15, spec) e do código real. Os mesmos diagramas existem em `previews/fluxos-e-regras.html` (sem rede, com alternador desktop/celular). Estados do job seguem o código: `queued`, `running`, `completed`, `failed`.

## A. Jornada de usabilidade

Produtor ou agrônomo, no escritório e no campo. Ramos à direita são caminhos de erro ou vazio.

```mermaid
flowchart TD
    S0["1. Criar fazenda: nome, município, UF"]
    E0_0["FARM_EXISTS (409): nome já usado. Troque o nome."]
    S0 -->|erro| E0_0
    class E0_0 err
    E0_1["VALIDATION_ERROR (400): nome vazio ou UF sem 2 letras"]
    S0 -->|erro| E0_1
    class E0_1 err
    S0 --> S1
    S1["2. Criar talhão: '+ Desenhar talhão' no mapa OU 'Importar GeoJSON/KML' (MultiPolygon vira N talhões)"]
    E1_0["INVALID_GEOMETRY (400): auto-interseção, anel aberto ou menos de 4 pontos. Nada é criado."]
    S1 -->|erro| E1_0
    class E1_0 err
    E1_1["INVALID_FILE (400): extensão fora de .geojson/.json/.kml, mais de 5 MB ou ilegível"]
    S1 -->|erro| E1_1
    class E1_1 err
    E1_2["NO_POLYGON (400): 'nenhum polígono encontrado no arquivo'"]
    S1 -->|erro| E1_2
    class E1_2 err
    S1 --> S2
    S2["3. Processar histórico dos últimos 6 meses (talhão ou fazenda inteira)"]
    E2_0["JOB_IN_PROGRESS (409): já há job queued/running. Aguarde esse job."]
    S2 -->|erro| E2_0
    class E2_0 err
    S2 --> S3
    S3{{"4. Job terminou? Acompanhar queued, running, completed"}}
    E3_0["failed NO_OFFLINE_DATA: talhão fora da região de demonstração no modo offline. Redesenhe dentro da área."]
    S3 -->|falhou| E3_0
    class E3_0 err
    E3_1["failed STAC_UNAVAILABLE ou WORKER_*: após 3 tentativas. Processe de novo mais tarde."]
    S3 -->|falhou| E3_1
    class E3_1 err
    S3 --> S4
    S4{{"5. Há cenas válidas?"}}
    E4_0["Sem cenas válidas no período: sem NDVI, estatística nem alerta. Tente depois."]
    S4 -->|não| E4_0
    class E4_0 warn
    S4 --> S5
    S5["6. Timeline: slider e play percorrem as cenas válidas; toque no mapa mostra o NDVI do pixel"]
    E5_0["Pixel nodata ou fora do talhão: 'sem dado'"]
    S5 -->|vazio| E5_0
    class E5_0 warn
    S5 --> S6
    S6["7. Comparar duas datas com o divisor arrastável"]
    S6 --> S7
    S7["8. Zonas baixo/médio/alto da última cena válida (ou da data escolhida) e 'Baixar GeoJSON das zonas'"]
    E7_0["SCENE_NOT_FOUND (404): a data escolhida não tem cena válida. Escolha outra."]
    S7 -->|erro| E7_0
    class E7_0 err
    S7 --> S8
    S8["9. Alertas: lista por severidade e 'Ver no mapa' (abre a data e enquadra a mancha)"]
    S8 --> S9
    S9{{"10. Geometria do talhão foi editada depois?"}}
    E9_0["needsReprocess: aviso 'Geometria alterada, reprocesse'. Reprocessar volta ao passo 3."]
    S9 -->|sim| E9_0
    class E9_0 warn
    S9 --> S10
    S10(["11. Gerar relatório PDF e baixar"])
    E10_0["NO_VALID_SCENE (422): talhão sem cena válida. Processe antes."]
    S10 -->|erro| E10_0
    class E10_0 err
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```

### Escritório e campo

| Momento | Escritório (desktop) | Campo (celular 375 px) |
|---|---|---|
| Cadastro | Importa o arquivo GeoJSON/KML da propriedade inteira | Desenha o talhão com o dedo sobre o satélite |
| Acompanhar | Painel lateral com série temporal, p10/p90 e marcadores de alerta | Painel vira bottom sheet; timeline com play ocupa a base |
| Decidir | Compara datas e baixa o GeoJSON das zonas para a máquina de taxa variável | Toca na mancha: "Ver no mapa" enquadra e o NDVI do pixel aparece |
| Entregar | Gera e baixa o PDF | Abre o PDF para mostrar ao produtor |

### Erros e estados vazios

| Situação | O que o usuário vê | Código | Origem |
|---|---|---|---|
| Criar fazenda com nome repetido | Já existe uma fazenda com esse nome | FARM_EXISTS 409 | api/src/farms/farms.service.ts:create |
| Desenhar ou importar polígono inválido | Geometria inválida: envie um Polygon GeoJSON válido | INVALID_GEOMETRY 400 | api/src/plots/plots.service.ts:assertValid |
| Arquivo ilegível, extensão errada ou acima de 5 MB | Mensagem de arquivo inválido; nada é criado | INVALID_FILE 400 | api/src/common/geo.ts:parseGeoFile |
| Arquivo sem Polygon nem MultiPolygon | nenhum polígono encontrado no arquivo | NO_POLYGON 400 | api/src/common/geo.ts:parseGeoFile |
| Processar com job ativo | Já existe um processamento em andamento para este talhão | JOB_IN_PROGRESS 409 | api/src/jobs/jobs.service.ts:enqueueOrReuse |
| Talhão fora da região offline | Job failed: Sem dados offline para esta área | NO_OFFLINE_DATA 422 (sem retry) | worker/app/sources/fixtures.py:list_scenes |
| STAC fora do ar em stac | Job failed após 3 tentativas | STAC_UNAVAILABLE 503 | worker/app/sources/stac.py:list_scenes |
| Todas as cenas com mais de 60% inválido | Sem cenas válidas no período | sem erro (cenas valid=false) | worker/app/mask.py:apply_mask |
| Zonas de data sem cena válida | Escolha outra data | SCENE_NOT_FOUND 404 | api/src/zones/zones.service.ts |
| Geometria editada depois do processamento | Geometria alterada, reprocesse | needsReprocess (flag, não é erro) | api/src/plots/plots.repository.ts:update |
| Relatório sem cena válida | Talhão sem cena válida para gerar relatório | NO_VALID_SCENE 422 | api/src/reports/reports.service.ts:enqueue |

## B. Fluxo técnico de processamento

### B1. Sequência completa

```mermaid
sequenceDiagram
    participant Web
    participant API
    participant Fila
    participant Worker
    participant Fonte
    participant Banco
    Web->>API: POST /plots/:id/process
    API->>Banco: Transação: trava o talhão (FOR UPDATE) e procura job queued/running
    API-->>Web: 409 JOB_IN_PROGRESS se já houver job ativo
    API->>Banco: INSERT job (status queued)
    API->>Fila: add history (3 tentativas, backoff exponencial de 5 s)
    API-->>Web: 202 com jobId
    Web->>API: GET /jobs/:id (consulta o status)
    Fila->>API: Consumer entrega o job (concorrência 2)
    API->>Banco: job running; lê o talhão; janela = hoje − 6 meses
    API->>Worker: POST /process (geometria + janela, timeout WORKER_TIMEOUT_MS)
    Worker->>Fonte: list_scenes conforme DATA_MODE (stac, fixtures ou auto com fallback)
    Fonte-->>Worker: Arquivos B04, B08 e SCL por data
    Worker->>Worker: Pipeline: NDVI, máscara, estatísticas, zonas e alertas
    Worker->>Worker: Grava PNG, GeoTIFF e GeoJSON no volume /data
    Worker-->>API: 200 com source e scenes[]
    API->>Banco: Transação: upsert de cenas, zonas e alertas; remove o que sumiu; needsReprocess
    API->>Banco: job completed com validScenes, discardedScenes e source
    API->>API: Notificação simulada: log notification.simulated (telefone ***)
    Web->>API: GET scenes, zones e alerts: desenha o mapa
    Note over Web,Banco: Falha: erro de domínio (NO_OFFLINE_DATA, NO_VALID_SCENE, NOT_FOUND) vira failed na 1ª vez, sem retry
    Note over Web,Banco: Falha transitória (WORKER_TIMEOUT, WORKER_UNAVAILABLE, STAC_UNAVAILABLE, INTERNAL): reenfileira até 3 tentativas; failed só na última
```

### B2. Fonte de dados

```mermaid
flowchart TD
    S0{{"DATA_MODE = fixtures?"}}
    E0_0["Usa as fixtures (Uruçuí-PI, 12 datas). Talhão fora da bbox: NO_OFFLINE_DATA 422, sem retry. source=fixtures"]
    S0 -->|sim| E0_0
    class E0_0 ok
    S0 --> S1
    S1{{"DATA_MODE = stac?"}}
    E1_0["Só STAC. Se cair: STAC_UNAVAILABLE 503 e o job tenta 3 vezes. source=stac"]
    S1 -->|sim| E1_0
    class E1_0 warn
    S1 --> S2
    S2["DATA_MODE = auto: tenta o STAC (timeout STAC_TIMEOUT_S, padrão 10 s)"]
    S2 --> S3
    S3{{"STAC respondeu?"}}
    E3_0["Sim: usa as cenas do STAC. source=stac"]
    S3 -->|sim| E3_0
    class E3_0 ok
    S3 --> S4
    S4(["Log de aviso e cai para as fixtures. source=fixtures (job não falha). Fora da bbox: NO_OFFLINE_DATA"])
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```

### B3. Persistência transacional

```mermaid
flowchart TD
    S0["Abre UMA transação (timeout 60 s)"]
    S0 --> S1
    S1["Cada cena: upsert por (talhão, data)"]
    S1 --> S2
    S2["Zonas: substitui as da cena (cena inválida fica sem zonas)"]
    S2 --> S3
    S3["Alertas: upsert por (talhão, data, tipo). Insert novo entra na lista de notificação"]
    S3 --> S4
    S4["Remove cenas da janela que o worker não devolveu"]
    S4 --> S5
    S5["Remove alertas da janela que sumiram"]
    S5 --> S6
    S6{{"updatedAt do talhão ≤ instante em que a geometria foi lida?"}}
    E6_0["Não: a geometria mudou durante o job. Mantém needsReprocess = true"]
    S6 -->|não| E6_0
    class E6_0 warn
    S6 --> S7
    S7(["Sim: needsReprocess = false. Commit. Job completed. Notificação simulada só dos alertas novos"])
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```

## C. Regras de negócio

### C1. Pipeline por cena (RN-01, RN-02, RN-03, RN-07)

```mermaid
flowchart TD
    S0["Recorta B04, B08 e SCL pelo polígono (SCL de 20 m sobe para a grade de 10 m)"]
    S0 --> S1
    S1["NDVI = (B08 − B04) / (B08 + B04)"]
    E1_0["B08 + B04 = 0: pixel nodata"]
    S1 -->|zero| E1_0
    class E1_0 warn
    S1 --> S2
    S2["Máscara: fora do polígono ou SCL em {3, 8, 9, 10} vira nodata"]
    E2_0["3 sombra, 8 e 9 nuvem, 10 cirrus"]
    S2 -->|SCL| E2_0
    class E2_0 warn
    S2 --> S3
    S3{{"Mais de 60% do talhão inválido?"}}
    E3_0["Cena valid=false: gravada sem estatística, PNG, zonas nem alertas"]
    S3 -->|sim| E3_0
    class E3_0 err
    S3 --> S4
    S4["Estatísticas: média, mediana, p10, p90 e % de área válida"]
    S4 --> S5
    S5["Zonas: quantis 33 e 66 dos pixels válidos. ≤ q33 baixo, ≤ q66 médio, resto alto. Vetoriza e soma ha por classe"]
    S5 --> S6
    S6["Alertas de queda e de mancha, contra as cenas válidas anteriores"]
    S6 --> S7
    S7(["Grava ndvi.png, ndvi.tif e zones.geojson em /data/plots/{talhão}/{data}/"])
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```

### C2. Alerta de queda (RN-08, RN-10)

```mermaid
flowchart TD
    S0{{"Há 3 ou mais cenas válidas anteriores?"}}
    E0_0["Não: sem alerta"]
    S0 -->|não| E0_0
    class E0_0 warn
    S0 --> S1
    S1["base = mediana das médias das 3 últimas cenas válidas"]
    S1 --> S2
    S2{{"base ≤ 0 ou média ≥ 85% da base?"}}
    E2_0["Sim: sem alerta (queda de até 15%)"]
    S2 -->|sim| E2_0
    class E2_0 ok
    S2 --> S3
    S3{{"média < 75% da base (queda > 25%)?"}}
    E3_0["Sim: alerta drop, severidade ALTA"]
    S3 -->|sim| E3_0
    class E3_0 err
    S3 --> S4
    S4(["Alerta drop, severidade MÉDIA (queda entre 15% e 25%)"])
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```

### C3. Alerta de mancha (RN-09, RN-10)

```mermaid
flowchart TD
    S0{{"Há pelo menos 1 cena válida anterior?"}}
    E0_0["Não: sem p10 histórico, sem alerta"]
    S0 -->|não| E0_0
    class E0_0 warn
    S0 --> S1
    S1["p10 histórico = percentil 10 de todos os pixels válidos das cenas anteriores"]
    S1 --> S2
    S2["Pixels com NDVI < p10 formam manchas contíguas (vizinhança de 4)"]
    S2 --> S3
    S3["Fica a maior mancha, em ha. Manchas dispersas não somam. 1 alerta por talhão e data"]
    S3 --> S4
    S4{{"Maior mancha > 1 ha?"}}
    E4_0["Não: sem alerta"]
    S4 -->|não| E4_0
    class E4_0 ok
    S4 --> S5
    S5{{"Maior mancha > 3 ha?"}}
    E5_0["Sim: alerta patch, severidade ALTA"]
    S5 -->|sim| E5_0
    class E5_0 err
    S5 --> S6
    S6(["Alerta patch, severidade MÉDIA (entre 1 e 3 ha). A geometria da mancha é salva"])
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```

### C4. Estados do job

```mermaid
stateDiagram-v2
    [*] --> queued : POST process cria o job
    queued --> running : consumer pega o job
    queued --> failed : QUEUE_UNAVAILABLE
    running --> running : erro transitório, retry com backoff de 5 s e 10 s
    running --> completed : worker ok e transação gravada
    running --> failed : erro de domínio ou 3ª tentativa
    completed --> [*]
    failed --> [*]
```

### Limiares conferidos no código

| Regra | Valor | Constante |
|---|---|---|
| Pixel inválido (SCL) | {3, 8, 9, 10} | worker/app/mask.py:INVALID_SCL |
| Descarte da cena | mais de 60% inválido | worker/app/mask.py:MAX_INVALID_PCT |
| Zonas | quantis 33 e 66 | worker/app/zones.py:make_zones |
| Queda: mínimo de cenas | 3 anteriores válidas | worker/app/alerts.py:MIN_PREV_SCENES |
| Queda média / alta | média < 0,85 × base; alta < 0,75 × base | worker/app/alerts.py:DROP_MEDIUM, DROP_HIGH |
| Mancha média / alta | maior mancha > 1 ha; alta > 3 ha | worker/app/alerts.py:PATCH_MEDIUM_HA, PATCH_HIGH_HA |
| Retries | 3 tentativas, backoff exponencial de 5 s | api/src/jobs/jobs.service.ts:ATTEMPTS |
| Janela do histórico | hoje − 6 meses até hoje | api/src/jobs/jobs.processor.ts:handle |
| Upload | até 5 MB; .geojson, .json, .kml | api/src/common/geo.ts:MAX_FILE_BYTES |

## D. Matriz regra, implementação e teste

| Regra | Onde está implementada | Teste que cobre |
|---|---|---|
| RN-01 NDVI e máscara SCL | worker/app/ndvi.py:ndvi; worker/app/mask.py:apply_mask | test_ndvi_mask.py: test_ndvi_values, test_zero_sum_is_nodata, test_scl_classes_masked, test_outside_polygon_ignored |
| RN-02 Descarte acima de 60% | worker/app/mask.py:apply_mask; worker/app/pipeline.py:process_plot | test_ndvi_mask.py: test_coverage_threshold; test_pipeline.py: test_scenes_and_invalid |
| RN-03 Estatísticas | worker/app/stats.py:scene_stats; api/src/jobs/result.persister.ts:persist | test_stats.py: test_stats, test_all_nodata |
| RN-04 Área em ha (geography) | api/src/plots/plots.repository.ts:insert/update (ST_Area) | api/test/integration/db.int-spec.ts (área calculada no SQL); plots.spec.ts (cria com areaHa) |
| RN-05 Desenho ou upload; MultiPolygon explodido | api/src/common/geo.ts:parseGeoFile; api/src/plots/plots.service.ts:importItems | api/test/plots-import.spec.ts (MultiPolygon, KML, INVALID_FILE, NO_POLYGON, transação) |
| RN-06 Histórico de 6 meses | api/src/jobs/jobs.processor.ts:handle | Sem teste da janela (lacuna). Indireto: jobs.spec.ts (processor) |
| RN-07 Zonas por quantis 33/66 | worker/app/zones.py:make_zones; api/src/zones/zones.service.ts | test_zones.py; api/src/zones/zones.spec.ts (padrão, download, SCENE_NOT_FOUND) |
| RN-08 Alerta de queda | worker/app/alerts.py:drop_alert | test_alerts.py: test_drop_needs_three_scenes, test_drop_severity; test_pipeline.py: test_problem_plot_alerts |
| RN-09 Alerta de mancha | worker/app/alerts.py:historical_p10, patch_alert | test_alerts.py: test_patch_severity, test_patch_without_history, test_scattered_pixels_do_not_add_up |
| RN-10 Severidades | worker/app/alerts.py (DROP_*, PATCH_*) | test_alerts.py: test_drop_severity, test_patch_severity |
| RN-11 Notificação simulada | api/src/notifications/notifications.service.ts:notifyNew/whatsapp/emit | notifications.spec.ts; api/test/notifications-privacy.spec.ts |
| RN-12 Sem auth, tenant único | Ausência de guard em api/src/app.module.ts (decisão) | Sem teste (não há comportamento a verificar) |
| RN-13 DATA_MODE com fallback | worker/app/sources/__init__.py:list_scenes | test_sources.py: test_auto_falls_back, test_fixtures_mode_no_stac; test_stac.py |
| RN-14 Fixtures e bbox offline | worker/app/sources/fixtures.py:list_scenes | test_fixtures.py; test_sources.py: test_outside_bbox |
| RN-15 PDF e recomendações | worker/app/report.py:recommendations/build_pdf; api/src/reports/reports.service.ts:enqueue | test_report.py: test_direction, test_recommendations, test_pdf; reports.spec.ts |
| Job: fila, retry, 409 | api/src/jobs/jobs.service.ts:enqueueOrReuse; jobs.processor.ts:handle | api/src/jobs/jobs.spec.ts (JOB_IN_PROGRESS, retry só na última, UnrecoverableError) |
| Persistência idempotente e needsReprocess | api/src/jobs/result.persister.ts:persist | api/test/integration/persister.int-spec.ts (2x mantém contagens; needsReprocess não zera) |
| Exclusão em cascata | api/src/farms/farms.service.ts:remove; FKs em api/prisma/schema.prisma | api/test/integration/farm-delete.int-spec.ts; db.int-spec.ts (cascata) |
| Telefone não persistido | api/src/notifications/notifications.service.ts:emit | api/test/notifications-privacy.spec.ts (log sem dígitos; schema sem coluna phone) |

### Divergências spec x código

- Estado do job: spec (RF-13) e código usam completed, não succeeded. Durante os retries o status continua running (não volta a queued); failed só na última tentativa ou em erro de domínio.
- Alta de queda confirmada no código: média < 0,75 × base (queda > 25%). Em exatamente 85% ou 75% a regra é estrita (sem alerta em 85%; média em 75%). Código ainda ignora base ≤ 0, o que a spec não cita.
- STAC pré-filtra eo:cloud_cover < 60 na busca (worker/app/sources/stac.py), além do descarte RN-02 por talhão. Não está na spec.
- Fixtures ignoram a janela de datas e devolvem as 12 cenas (comentário P1 em fixtures.py). Por isso o histórico offline não é limitado a 6 meses.
- RN-06 (janela de 6 meses) não tem teste dedicado.
- Em modo stac/auto o polígono do talhão é enviado ao STAC público (intersects). A spec não trata isso como dado pessoal; ver aba LGPD.

## E. Mapa de LGPD

| Dado | Onde é guardado | O que é logado | Exclusão |
|---|---|---|---|
| Nome, município e UF da fazenda (pode identificar o produtor) | Postgres: tabela farm | Não é logado | DELETE /farms/:id (cascata) |
| Nome e contorno do talhão (localização da propriedade) | Postgres: plot (PostGIS) | Não é logado | DELETE /plots/:id ou da fazenda |
| NDVI, zonas, alertas e estatísticas derivados | Postgres (ndvi_scene, zone, alert) e /data/plots/{talhão}/{data}/ | Só o alertId no log de notificação | Cascata + remoção das pastas após o commit |
| Relatórios PDF (nome do talhão, alertas) | Postgres: report e /data/reports/{talhão}/ | Não é logado | Cascata + remoção da pasta |
| Jobs (errorCode, errorMessage, result) | Postgres: job | Erro interno loga stack no servidor, sem payload pessoal | Cascata |
| Telefone (opcional em POST /notifications/whatsapp) | Nunca persistido: sem coluna phone; só em memória na chamada | notification.simulated com phone "***" | Nada a apagar |
| Polígono enviado ao STAC público (modos stac e auto) | Não fica guardado por nós; sai da máquina na consulta | Aviso quando cai para fixtures | Use DATA_MODE=fixtures para nada sair |
| Conta, e-mail, cookies, localStorage | Não existem (sem auth, RN-12). Aviso em /privacidade | - | - |

### Exclusão em cascata

```mermaid
flowchart TD
    S0["Lista os ids dos talhões da fazenda"]
    S0 --> S1
    S1{{"Fazenda existe? Apaga a linha de farm"}}
    E1_0["NOT_FOUND (404). Nenhum arquivo é tocado"]
    S1 -->|não| E1_0
    class E1_0 err
    S1 --> S2
    S2["FK ON DELETE CASCADE no banco: plot, ndvi_scene, zone, alert, job, report"]
    S2 --> S3
    S3["Só depois do commit: remove /data/plots/{id} e /data/reports/{id} de cada talhão"]
    S3 --> S4
    S4(["204 sem corpo. DELETE /plots/:id faz o mesmo para um talhão"])
    classDef err fill:#f6dcd6,stroke:#a8321f,color:#1f2a1c
    classDef warn fill:#f3e6d3,stroke:#8a5a2b,color:#1f2a1c
    classDef ok fill:#e1ecd8,stroke:#3f6b2a,color:#1f2a1c
```
