#!/usr/bin/env bash
# Processa a fazenda demo e espera os jobs terminarem. Idempotente (o enqueue reaproveita job em andamento).
set -euo pipefail
API="${API_URL:-http://localhost:${API_HOST_PORT:-3001}/api/v1}"
TIMEOUT="${WAIT_TIMEOUT_S:-600}"

farm=$(curl -fsS "$API/farms?pageSize=100" | jq -r '.data[] | select(.name=="Fazenda Demo Uruçuí") | .id' | head -1)
[ -n "$farm" ] || { echo "fazenda demo nao encontrada (rode o seed)" >&2; exit 1; }
jobs=$(curl -fsS -X POST "$API/farms/$farm/process" | jq -r '.jobIds[]')

end=$((SECONDS + TIMEOUT))
for j in $jobs; do
  while :; do
    s=$(curl -fsS "$API/jobs/$j" | jq -r '.status')
    case "$s" in
      completed) echo "job $j ok"; break ;;
      failed) echo "job $j falhou" >&2; exit 1 ;;
    esac
    [ $SECONDS -lt $end ] || { echo "timeout esperando job $j ($s)" >&2; exit 1; }
    sleep 2
  done
done
