#!/usr/bin/env bash
set -e

echo "==> Installing backend dependencies..."
npm ci

echo "==> Building TypeScript..."
npm run build

echo "==> Build complete."
