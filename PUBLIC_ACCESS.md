# Public Access - Quick Guide

Make your RLM-Conversation app accessible from anywhere with just 3 steps!

## Quick Start (3 Steps)

### Step 1: Deploy in Sandbox

```bash
# Clone the repo
git clone https://github.com/your-org/RLM-Conversation.git
cd RLM-Conversation

# Setup (one-time)
cp .env.example .env
nano .env  # Add your API keys

# Install backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
pip install -e .

# Install frontend
cd frontend
npm install
cd ..
```

### Step 2: Start the App

```bash
./start-public.sh
```

Or manually:
```bash
# Backend
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124 &

# Frontend
cd frontend
npm run build && npm run start -- -p 3001 -H 0.0.0.0 &
```

### Step 3: Expose with Tunnel

**Option A: ngrok (Recommended)**
```bash
# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Get auth token from https://ngrok.com/signup (free)
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel
ngrok http 3001
```

**Option B: Cloudflare Tunnel (No Signup)**
```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Start tunnel
cloudflared tunnel --url http://localhost:3001
```

**Option C: localtunnel (Simplest)**
```bash
npx localtunnel --port 3001
```

## That's It!

You'll get a public URL like:
- ngrok: `https://abc123.ngrok.io`
- Cloudflare: `https://xyz.trycloudflare.com`
- localtunnel: `https://random-name.loca.lt`

Share this URL with anyone - they can access your app from their browser!

## For Production

If you need a permanent deployment (not in sandbox), see [DEPLOYMENT.md](DEPLOYMENT.md) for nginx/docker setup.

## Troubleshooting

**Can't access from external browser?**
- Make sure `.env` has `HOST=0.0.0.0` (not `127.0.0.1`)
- Check if backend is running: `curl http://localhost:9124/health`
- Check if frontend is running: `curl http://localhost:3001`

**SSE streaming not working?**
- The app automatically detects the public URL
- Make sure the tunnel is pointing to port 3001 (frontend)
- Check browser console for errors

**Port already in use?**
```bash
# Kill existing processes
lsof -ti :9124 | xargs kill -9
lsof -ti :3001 | xargs kill -9
```
