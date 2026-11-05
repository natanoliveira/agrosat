.PHONY: up demo test test-int lint e2e fixtures audit audit-strict

up:
	docker compose up -d --build --wait

demo:
	DATA_MODE=fixtures docker compose up -d --build --wait
	docker compose exec api npx prisma migrate deploy
	docker compose exec api npx prisma db seed
	./scripts/wait-jobs.sh

test:
	cd api && npm test
	cd worker && .venv/bin/pytest

test-int:
	cd api && npm run test:int

lint:
	cd api && npm run lint
	cd web && npm run lint
	cd worker && .venv/bin/ruff check . && .venv/bin/mypy .

e2e:
	./scripts/e2e.sh

fixtures:
	cd worker && python scripts/gen_fixtures.py

audit:
	@echo "api/web: Nest 10 e Next 14 (stack do init.md) tem altas conhecidas, aceitas e listadas no TODO.md"
	-cd api && npm audit --omit=dev --audit-level=high
	-cd web && npm audit --omit=dev --audit-level=high
	@if [ -f e2e/package.json ]; then cd e2e && npm audit --omit=dev --audit-level=high; fi
	cd worker && .venv/bin/pip-audit

audit-strict:
	cd api && npm audit --omit=dev --audit-level=high
	cd web && npm audit --omit=dev --audit-level=high
	cd worker && .venv/bin/pip-audit
