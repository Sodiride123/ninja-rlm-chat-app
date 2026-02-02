#!/bin/bash
# Simple script to start RLM-Conversation for public access

set -e

echo "🚀 Starting RLM-Conversation for public access..."

# Check if in correct directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: Run this script from the RLM-Conversation directory"
    exit 1
fi

# Start backend
echo "📦 Starting backend on 0.0.0.0:9124..."
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 3

# Start frontend
echo "🌐 Starting frontend on 0.0.0.0:3001..."
cd frontend
npm run build > /dev/null 2>&1
npm run start -- -p 3001 -H 0.0.0.0 &
FRONTEND_PID=$!
cd ..
echo "✅ Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend to be ready
sleep 5

echo ""
echo "✅ Application is running!"
echo ""
echo "================================================"
echo "📍 To make it publicly accessible, use ngrok:"
echo "================================================"
echo ""
echo "   ngrok http 3001"
echo ""
echo "Or use Cloudflare Tunnel (no signup needed):"
echo ""
echo "   cloudflared tunnel --url http://localhost:3001"
echo ""
echo "The tunnel will give you a public URL like:"
echo "   https://abc123.ngrok.io"
echo ""
echo "Share this URL with anyone to access the app!"
echo ""
echo "================================================"
echo ""
echo "To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Keep script running
wait
