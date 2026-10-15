#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
node "$project_root/scripts/embed-html.mjs"
mkdir -p "$project_root/dist/.openai"
cp "$project_root/.openai/hosting.json" "$project_root/dist/.openai/hosting.json"
echo "Built Pawprint Worker"
