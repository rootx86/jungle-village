#!/usr/bin/env bash
set -e

# Migrations run automatically on startup inside index.ts (via waitForDb + migrate()).
# This script is here if Railway ever needs an explicit start entrypoint.
echo "==> Starting backend server (migrations run on boot)..."
exec node dist/index.js
