# TODO — fora do MVP

## Dados e LGPD
- [ ] Portabilidade/exportação dos dados do titular (hoje só os GETs devolvem tudo).
- [ ] Log de auditoria de quem apagou o quê (impossível sem auth, RN-12).
- [ ] Política de retenção automática (hoje os dados ficam até exclusão explícita).

## Fontes de dados e build
- [ ] STAC real não foi exercitado com dados reais; em `auto` já travou por mais de 100 s. Revisar timeouts por requisição e o limite total da busca.
- [ ] Build `linux/amd64` não foi testado (desenvolvido em arm64/macOS).

## Qualidade
- [ ] Lint do worker: `mypy .` tinha 7 erros antigos; confirmar se ainda existem e zerar (o `make lint` roda só `ruff check .`).
- [ ] `make e2e` aponta para `e2e/`; confirmar que a suíte Playwright existe e roda verde.
- [ ] RN-06 (janela de 6 meses) sem teste dedicado.
- [ ] RN-12 (sem auth, tenant único) sem teste (não há comportamento a verificar; reavaliar quando houver auth).

## Produto
- [ ] Incluir `farmId` na resposta de alerta da API.
- [ ] Link do dashboard na lista de fazendas.

## Hardening de produção
- [ ] Autenticação e autorização (multi-tenant).
- [ ] TLS/HTTPS e proxy reverso; CORS e `PUBLIC_FILES_URL` de produção.
- [ ] Retenção e backup de dados; rate limit revisado para carga real.
- [ ] Segredos fora do `.env` versionável (gerenciador de segredos).
- [ ] Dependências com vulnerabilidades altas aceitas no MVP (`make audit-strict` falha): web — Next 14 (2 críticas, 4 altas; correção em 16.x), maplibre-gl 6.x, postcss; api — Nest 10 (body-parser, multer, glob, js-yaml, lodash; correção em Nest 12). Plano: migrar Next 14→16 e Nest 10→12 em tarefa própria, com revalidação do mapa, builds e e2e.

## Pendências do ciclo (retomar daqui)
Estado: 55/59 tarefas marcadas em `docs/specs/agrosat-mvp/tasks.md`. Build, tsc e lint passam em web e api no último check.
- [x] **Botão "Processar histórico" (lacuna do fluxo init.md):** `web/components/panel/ProcessButton.tsx` existe mas a integração na página do mapa/dashboard e o estado "sem cenas" não foram conferidos; `e2e/tests/main-flow.spec.ts` ainda chama `POST /plots/:id/process` pela API em vez de clicar no botão. Agente interrompido no meio.
- [x] **`NEXT_PUBLIC_E2E=1`:** o gate de `window.__map` já está em `MapView.tsx:45` e `scripts/e2e.sh` exporta a variável, mas falta passá-la como build arg no `web/Dockerfile`/compose (senão o e2e não acha `__map`). Documentar em DECISIONS.md.
- [ ] **T-56 sem `make e2e`:** helmet, CORS, throttler e worker sem porta pública (profile `debug`) implementados e com `npm test -- security` verde (80 testes na API), mas o critério "make e2e continua verde" não foi rodado. Rodar `make e2e` e revisar `docker-compose.yml`.
- [ ] **T-35 e T-46/T-45:** T-35 (CRUD de fazendas) sem validação visual no navegador; conferir.
- [ ] **CA-G1 visual:** abrir http://localhost:3005 após `docker compose up` + `make demo` e ver overlay NDVI e a timeline; conferir setas ↑/↓ do dashboard e o link do dashboard na lista de fazendas.
- [ ] **README:** comandos não testados do zero (rodar `docker compose up` + `make demo` limpos).
- [ ] **STAC real:** `/process` em `DATA_MODE=auto` com rede ficou >100 s sem resposta; investigar timeout/lentidão e a reamostragem SCL 20 m→10 m.
- [ ] **Ambiente:** encerrar processos soltos (`nest start --watch` e `node dist/main` de agentes) que consomem a fila do Redis padrão; limpar a "Fazenda T34" do banco de dev.
- [ ] **Revisão final do ciclo-grande:** revisar o diff contra os critérios de aceite (spec CA-G1..G5), auditoria de segurança/LGPD e gerar `graphify update .` se aplicável.
- [x] **Docs (DECISIONS feito; faltam previews/design-system.html e analise-ndvi.html):** deixar a rampa NDVI precisa no DECISIONS.md (vermelho até 0,15, amarelo em 0,5, verde em 0,9); `previews/design-system.html` e `analise-ndvi.html` ainda citam a rampa de 3/6 paradas.
