#!/usr/bin/env sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

npm run build:web
npx cap sync android
