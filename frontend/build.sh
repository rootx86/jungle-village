#!/usr/bin/env bash
set -e

echo "==> Installing frontend dependencies..."
npm install --no-audit --no-fund

echo "==> Building Next.js app..."
npm run build

echo "==> Build complete."
