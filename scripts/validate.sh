#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Tests ==="
npm test

echo "=== 2. Build ==="
npm run build

echo "=== 3. Dogfood scan (ctx-keeper) ==="
node bin/ctx.js init --dir "$ROOT" 2>/dev/null || true
OUT=$(node bin/ctx.js scan --dir "$ROOT")
echo "$OUT"
EDGES=$(echo "$OUT" | grep -oP '\d+(?= modules)')
if [ "$EDGES" -lt 1 ]; then
  echo "FATAL: dogfood scan found 0 modules!"
  exit 1
fi
echo "  → ${EDGES} modules OK"

echo ""
echo "=== 4. External project scans ==="
SCAN_DIRS=(
  "$ROOT/../education-quant-os"
  "$ROOT/../mistake-scanner-demo"
  "$ROOT/../poker-engine-v2"
)
for project in "${SCAN_DIRS[@]}"; do
  NORM=$(realpath "$project" 2>/dev/null || echo "$project")
  if [ -d "$NORM" ]; then
    echo "--- scan: $(basename "$NORM") ---"
    node bin/ctx.js scan --dir "$NORM" 2>&1 || echo "  (scan failed)"
  else
    echo "--- skip: $(basename "$NORM") (not found) ---"
  fi
done

echo ""
echo "✓ validation passed"
