#!/usr/bin/env bash
set -e

echo "==> Installing backend dependencies..."
npm install --no-audit --no-fund

echo "==> Building TypeScript..."
npm run build

echo "==> Build complete."
