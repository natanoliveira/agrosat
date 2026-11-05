# AgroSat MVP — Análise

Fonte: `init.md`. UI 100% pt-BR; identificadores de código em inglês.

## Objetivo
- Monitor de saúde de lavoura por NDVI (Sentinel-2) para produtores/agrônomos do MATOPIBA.
- `docker compose up` + `make demo` → http://localhost:3005 mostra fazenda demo (Uruçuí-PI) com NDVI colorido.

## Regras de negócio
- RN-01 NDVI = (B08 − B04) / (B08 + B04); pixels SCL ∈ {3, 8, 9, 10} → nodata.
- RN-02 Cena descartada se > 60% do talhão for nuvem/sombra/nodata.
- RN-03 Estatísticas por talhão+data: média, mediana, p10, p90, % área válida.
- RN-04 Área do talhão em ha via `ST_Area(geography)`; geometria `geometry(Polygon, 4326)`.
- RN-05 Talhão aceita desenho no mapa ou upload GeoJSON/KML (apenas Polygon; MultiPolygon é explodido em N talhões).
- RN-06 Histórico: job processa os últimos 6 meses.
- RN-07 Zonas: 3 classes (baixo/médio/alto vigor) por quantis 33%/66% dos pixels válidos, **por cena**. Padrão = última cena válida; UI permite escolher a data. Vetorizadas, com área (ha) por zona; exportável como GeoJSON.
- RN-08 Alerta de queda: média da cena < 85% da mediana das 3 cenas válidas anteriores. Exige ≥ 3 cenas anteriores válidas, senão não alerta.
- RN-09 Alerta de mancha: área contígua > 1 ha com NDVI < p10 histórico. p10 histórico = p10 de todos os pixels válidos das cenas anteriores do talhão.
- RN-10 Severidade: queda 15–25% = média, > 25% = alta. Mancha > 1 ha = média, > 3 ha = alta.
- RN-11 Notificação simulada: log + endpoint preparado para WhatsApp (sem envio real).
- RN-12 Sem auth, tenant único.
- RN-13 Worker `DATA_MODE=auto|stac|fixtures`: `auto` tenta STAC e cai para fixtures sem rede. Seed e testes forçam `fixtures`.
- RN-14 Fixtures: GeoTIFFs sintéticos de Uruçuí-PI (~ -7.23, -44.55), bbox ~10×10 km, 12 datas, 1 talhão "doente" que piora com o tempo. Talhão fora da bbox em modo offline → erro "sem dados offline para esta área".
- RN-15 PDF por talhão (gerado no worker): mapa NDVI atual, zonas, gráfico histórico, alertas e recomendações em texto por regras (ex.: "investigar porção nordeste do talhão 3").

## Arquitetura (decisões)
- D-01 Fila: API (NestJS + BullMQ) consome jobs e chama o worker via HTTP (FastAPI); resultado por resposta/callback. Python não consome BullMQ.
- D-02 Armazenamento: volume Docker compartilhado (api/worker/web) para PNG, GeoJSON de zonas e PDF; metadados no Postgres.
- D-03 Stack: NestJS+Prisma+Postgres16/PostGIS, FastAPI+rasterio+numpy+shapely+pystac-client, Next.js 14 (App Router)+Tailwind+MapLibre GL+Recharts, Redis.
- D-04 Playwright roda contra `docker compose` completo em modo fixtures.
- D-05 Decisões registradas também em `DECISIONS.md` (raiz).

## Fora de escopo
- Auth/multiusuário, envio real de WhatsApp, S3/MinIO, geração de raster sintético fora da bbox, MultiPolygon como talhão único.

## Casos de borda
- Talhão sem cena válida (todas > 60% nuvem) → sem estatística, sem alerta.
- Menos de 3 cenas anteriores → sem alerta de queda.
- Upload GeoJSON/KML inválido, sem Polygon, ou com geometria inválida → erro 400 com mensagem pt-BR.
- Talhão fora da bbox em modo offline (RN-14).
- STAC indisponível em `auto` → fallback silencioso com log.
- Reprocessar mesma data → upsert idempotente.

## Perguntas em aberto
- Nenhuma. Itens 1–7 do spec.md §8 resolvidos com os padrões propostos (ver spec.md).
