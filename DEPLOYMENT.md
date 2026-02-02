# Quick Deployment Guide

Deploy the RLM-Conversation web app on Linux in 5 minutes.

## Prerequisites

- Python 3.11+ and Node.js 18+
- Anthropic API key or OpenAI API key

## Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd RLM-Conversation

# 2. Set up API keys
cp .env.example .env
nano .env  # Add your ANTHROPIC_API_KEY or OPENAI_API_KEY

# 3. Install backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
pip install -e .

# 4. Install frontend
cd frontend
npm install
cd ..

# 5. Run the app (in two terminals)
# Terminal 1:
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124

# Terminal 2:
cd frontend
npm run dev -- -p 3001 -- --host 0.0.0.0
```

Open `http://localhost:3001` in your browser. Done!

## Running in Background (Optional)

Use `screen` to keep the app running:

```bash
# Start backend
screen -dmS rlm-backend bash -c 'cd ~/RLM-Conversation && source backend/.venv/bin/activate && PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124'

# Start frontend
screen -dmS rlm-frontend bash -c 'cd ~/RLM-Conversation/frontend && npm run dev -- -p 3001 -- --host 0.0.0.0'

# View running sessions
screen -ls

# Reattach to a session
screen -r rlm-backend
```

That's it! The app is now running and accessible from your network.
