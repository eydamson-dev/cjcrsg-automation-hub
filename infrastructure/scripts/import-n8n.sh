#!/usr/bin/env bash
set -euo pipefail

# Import the M5 n8n workflows into a running n8n container.
#
# Usage: infrastructure/scripts/import-n8n.sh [container-name]
# Defaults to the compose service name `n8n`.

CONTAINER="${1:-n8n}"
SRC=/workflows

if ! docker compose ps --format '{{.Name}}' | grep -q "^${CONTAINER}$"; then
  echo "n8n container '${CONTAINER}' is not running. Start the stack first." >&2
  exit 1
fi

docker compose exec -T "${CONTAINER}" n8n import:workflow --separate --input="${SRC}"
echo "Workflows imported. Their names appear under n8n > Workflows; activate them there."