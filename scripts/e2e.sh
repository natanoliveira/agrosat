#!/usr/bin/env bash
# Roda o Playwright. Se a stack não responde, sobe uma isolada (projeto compose próprio) e derruba no fim.
set -euo pipefail
cd "$(dirname "$0")/.."
export API_HOST_PORT="${API_HOST_PORT:-3001}" WEB_HOST_PORT="${WEB_HOST_PORT:-3005}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:$WEB_HOST_PORT}" DATA_MODE=fixtures NEXT_PUBLIC_E2E=1
export API_URL="http://localhost:$API_HOST_PORT/api/v1" WEB_URL="http://localhost:$WEB_HOST_PORT"

up=0
if ! curl -fsS "$API_URL/health" >/dev/null 2>&1; then
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-agrosate2e}"
  up=1
  trap 'docker compose down -v' EXIT
  docker compose up -d ${E2E_BUILD---build} --wait
  docker compose exec -T api npx prisma migrate deploy
  docker compose exec -T api npx prisma db seed
  ./scripts/wait-jobs.sh
fi
cd e2e && npx playwright test
