#!/usr/bin/env bash
set -e

WORKSPACE_PATH="/Workspace/Users/zivile.norkunaite@databricks.com/.bundle/fe-anz-energy-hub/dev/files"

# Rebuild frontend only if source is newer than last build
DIST="frontend/dist/index.html"
NEWEST_SRC=$(find frontend/src frontend/index.html frontend/tailwind.config.js -newer "$DIST" 2>/dev/null | head -1)

if [ ! -f "$DIST" ] || [ -n "$NEWEST_SRC" ]; then
  echo ">>> Frontend source changed, rebuilding..."
  cd frontend && npm run build && cd ..
else
  echo ">>> Frontend up to date, skipping build"
fi

echo ">>> Deploying bundle..."
databricks bundle deploy --force-lock

echo ">>> Deploying app..."
databricks apps deploy fe-anz-energy-hub --source-code-path "$WORKSPACE_PATH"

echo ">>> Done!"
