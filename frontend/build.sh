#!/usr/bin/env bash
set -e

echo "==> Installing frontend dependencies..."
npm install 

echo "==> Building Next.js app..."
npm run build

echo "==> Build complete."
