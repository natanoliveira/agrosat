# Projeto: AgroSat — Monitor de lavoura por satélite (NDVI)

## Contexto
Você é um time sênior (tech lead + GIS engineer + frontend + QA). Construa um MVP
funcional de monitoramento de saúde de lavoura usando imagens Sentinel-2 gratuitas.
Público: produtores e agrônomos do MATOPIBA (Piauí). Interface 100% em pt-BR.

Trabalhe em paralelo com subagentes (backend, worker GIS, frontend, testes).
Não pare para pedir confirmação: tome decisões razoáveis e registre em DECISIONS.md.

## Stack obrigatória
- Monorepo com Docker Compose
- **api/**: NestJS + TypeScript + Prisma + PostgreSQL 16 com **PostGIS**
- **worker/**: Python 3.12 + FastAPI + rasterio + numpy + shapely + pystac-client
- **web/**: Next.js 14 (App Router) + React + TypeScript + Tailwind + **MapLibre GL**
- Fila: Redis + BullMQ (api → worker)

## Fonte de dados
- STAC público Element84 Earth Search: `https://earth-search.aws.element84.com/v1`,
  coleção `sentinel-2-l2a` (COGs públicos, sem chave)
- Bandas: B04 (red), B08 (NIR), SCL (máscara de nuvem)
- **Fallback obrigatório**: se não houver rede, usar fixtures em `worker/fixtures/`
  (gere GeoTIFFs sintéticos realistas de uma fazenda em Uruçuí-PI, ~-7.23, -44.55,
  com 12 datas e um talhão "doente" que piora com o tempo). Os testes rodam 100% offline.

## Funcionalidades

### 1. Fazendas e talhões
- CRUD de fazenda (nome, município, UF)
- Desenhar talhões como polígonos no mapa (MapLibre + maplibre-gl-draw), salvos como
  `geometry(Polygon, 4326)` no PostGIS
- Importar talhões por upload de GeoJSON/KML
- Calcular área em hectares (ST_Area em geography)

### 2. Processamento NDVI (worker)
- NDVI = (B08 - B04) / (B08 + B04)
- Mascarar nuvem/sombra pelo SCL (classes 3, 8, 9, 10 → nodata)
- Recortar pelo polígono do talhão (rasterio.mask)
- Descartar cenas com > 60% de nuvem dentro do talhão
- Salvar por talhão e data: média, mediana, p10, p90, % de área válida
- Gerar PNG colorido (rampa vermelho → amarelo → verde, -0.2 a 0.9) + bounds,
  servido como camada image source no MapLibre
- Job "histórico": processar os últimos 6 meses

### 3. Zonas de manejo
- Classificar pixels em 3 zonas (baixo / médio / alto vigor) por quantis
- Vetorizar as zonas (rasterio.features.shapes) e retornar GeoJSON com área de cada zona
- Exportar o GeoJSON das zonas (para máquina de taxa variável)

### 4. Alertas
- Alerta quando a média do talhão cair > 15% em relação à mediana das 3 cenas anteriores
- Alerta de "mancha": área contígua > 1 ha com NDVI < p10 histórico
- Lista de alertas com severidade, data, link "ver no mapa"
- Notificação simulada (log + endpoint preparado para WhatsApp)

### 5. Interface (efeito "uau")
- Mapa satélite em tela cheia (tiles ESRI World Imagery) com overlay NDVI semitransparente
- **Slider de timeline** que anima o NDVI ao longo das datas (botão play)
- Modo **comparar**: divisor arrastável entre duas datas (antes/depois)
- Painel lateral: gráfico de série temporal do NDVI por talhão (Recharts), com
  marcação dos alertas
- Legenda de cores, clique no pixel mostra o valor NDVI
- Dashboard da fazenda: cards por talhão (NDVI atual, tendência ↑↓, último alerta)
- Responsivo (agrônomo usa no celular no campo)

### 6. Relatório
- PDF por talhão: mapa NDVI atual, zonas, gráfico histórico, alertas e recomendações
  em texto ("investigar porção nordeste do talhão 3")

## Qualidade
- Testes: Jest (api), pytest (worker, cobrindo NDVI, máscara de nuvem, zonas e alertas
  com fixtures), Playwright (fluxo: criar fazenda → desenhar talhão → processar →
  ver timeline → ver alerta)
- Lint + typecheck sem erros
- Seed com a fazenda demo de Uruçuí-PI (3 talhões, 1 problemático)
- README em pt-BR: arquitetura (diagrama Mermaid), como subir, como funciona o NDVI
  explicado com analogia para leigo
- `docker compose up` sobe tudo; `make demo` popula o seed e processa o histórico

## Critérios de aceite
1. `docker compose up` + `make demo` → abrir http://localhost:3005 e ver a fazenda
   demo com NDVI colorido
2. A timeline anima 12 datas e mostra o talhão problemático ficando vermelho
3. Pelo menos 1 alerta gerado automaticamente no seed
4. Todos os testes passam offline
5. O PDF do relatório é gerado sem erro

## Ordem de execução
1. Planejar arquitetura e contrato de API (OpenAPI) → DECISIONS.md
2. Em paralelo: worker GIS + fixtures | api + PostGIS | web + mapa
3. Integrar via fila
4. Testes e2e, corrigir até passar
5. Revisão final: rodar tudo do zero, conferir os critérios de aceite, listar
   o que faltou em TODO.md