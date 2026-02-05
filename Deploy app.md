# Deploy App

## 1. Configure LiteLLM Proxy Settings

Obtain the LiteLLM proxy credentials from `/root/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "<your-token>",
    "ANTHROPIC_BASE_URL": "<your-base-url>",
    ...
  },
  ...
}
```

Extract and set as environment variables:

```bash
export ANTHROPIC_AUTH_TOKEN=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' /root/.claude/settings.json)
export ANTHROPIC_BASE_URL=$(jq -r '.env.ANTHROPIC_BASE_URL' /root/.claude/settings.json)
```

## 2. Create .env File

```bash
cd ~/ninja-rlm-chat-app

cat > .env << EOF
# LiteLLM Proxy Configuration
ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}
ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}

# Server Settings
HOST=0.0.0.0
PORT=9124
EOF
```

## 3. Start the Application

### Option A: Run in Foreground (two terminals)

**Terminal 1 - Backend:**
```bash
cd ~/ninja-rlm-chat-app
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124
```

**Terminal 2 - Frontend:**
```bash
cd ~/ninja-rlm-chat-app/frontend
npm run dev -- -H 0.0.0.0
```

### Option B: Run in Background (using screen)

```bash
cd ~/ninja-rlm-chat-app

# Start backend
screen -dmS rlm-backend bash -c 'source backend/.venv/bin/activate && PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124'

# Start frontend
screen -dmS rlm-frontend bash -c 'cd frontend && npm run dev -- -H 0.0.0.0'

# View running sessions
screen -ls
```

## 4. Access the App

Open `http://<your-vm-ip>:3001` in your browser.

## Troubleshooting

### Check if servers are running
```bash
# Check backend (port 9124)
curl http://localhost:9124/health

# Check frontend (port 3001)
curl http://localhost:3001
```

### View logs
```bash
# Reattach to backend
screen -r rlm-backend

# Reattach to frontend
screen -r rlm-frontend

# Detach from screen: Ctrl+A, then D
```

### Restart servers
```bash
# Kill existing processes
screen -X -S rlm-backend quit
screen -X -S rlm-frontend quit

# Start again (see Option B above)
```
