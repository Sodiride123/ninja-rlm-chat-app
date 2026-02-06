#!/bin/bash
# Quick deploy script - run this to start the app
# Usage: cd ~/ninja-rlm-chat-app && ./deploy.sh

set -e

APP_DIR="${APP_DIR:-$(pwd)}"
SETTINGS_FILE="/root/.claude/settings.json"

echo "==> Configuring credentials..."
ANTHROPIC_AUTH_TOKEN=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' "$SETTINGS_FILE")
ANTHROPIC_BASE_URL=$(jq -r '.env.ANTHROPIC_BASE_URL' "$SETTINGS_FILE")

cat > "$APP_DIR/.env" << EOF
ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}
ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
HOST=0.0.0.0
PORT=9124
DEFAULT_MODEL=claude-opus-4-6
EOF
echo "    .env created"

echo "==> Starting backend..."
cd "$APP_DIR"
source backend/.venv/bin/activate
PYTHONPATH="$APP_DIR" nohup uvicorn backend.main:app --host 0.0.0.0 --port 9124 > /tmp/backend.log 2>&1 &
echo "    Backend PID: $!"

echo "==> Starting frontend..."
cd "$APP_DIR/frontend"
nohup npm run dev -- -H 0.0.0.0 -p 3001 > /tmp/frontend.log 2>&1 &
