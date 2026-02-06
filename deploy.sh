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
EOF
echo "    .env created"

echo "==> Starting backend..."
screen -dmS rlm-backend bash -c "cd $APP_DIR && source backend/.venv/bin/activate && PYTHONPATH=$APP_DIR uvicorn backend.main:app --host 0.0.0.0 --port 9124"

echo "==> Starting frontend..."
screen -dmS rlm-frontend bash -c "cd $APP_DIR/frontend && npm run dev -- -H 0.0.0.0"

sleep 2
echo "==> Done! App running at http://localhost:3001"
screen -ls
