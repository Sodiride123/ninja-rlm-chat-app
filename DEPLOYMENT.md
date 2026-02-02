# Quick Deployment Guide for Linux

This guide will help you deploy the RLM-Conversation web app on any Linux machine in under 10 minutes.

## Prerequisites

Before starting, ensure you have:
- Ubuntu 20.04+ or similar Linux distribution
- At least 4GB RAM
- Internet connection
- Anthropic API key and/or OpenAI API key

## Step 1: Install Dependencies

```bash
# Update package list
sudo apt update

# Install Python 3.11+ (if not already installed)
sudo apt install -y python3 python3-pip python3-venv

# Install Node.js 18+ and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
python3 --version  # Should be 3.11 or higher
node --version     # Should be v18 or higher
npm --version      # Should be 9 or higher
```

## Step 2: Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/RLM-Conversation.git
cd RLM-Conversation

# Create .env file from example
cp .env.example .env

# Edit .env and add your API keys
nano .env
# Add your keys:
# ANTHROPIC_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here
# Save and exit (Ctrl+X, Y, Enter)
```

## Step 3: Install Backend

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install RLM package from repo root
cd ..
pip install -e .

# Return to project root
cd ..
```

## Step 4: Install Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install npm packages
npm install

# Return to project root
cd ..
```

## Step 5: Start the Application

You'll need two terminal windows or use a terminal multiplexer like `tmux` or `screen`.

### Terminal 1 - Backend Server

```bash
cd RLM-Conversation

# Activate virtual environment
source backend/.venv/bin/activate

# Start backend on port 9124
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124
```

Backend will be available at `http://YOUR_SERVER_IP:9124`

### Terminal 2 - Frontend Server

```bash
cd RLM-Conversation/frontend

# Start frontend on port 3001
npm run dev -- -p 3001 -- --host 0.0.0.0
```

Frontend will be available at `http://YOUR_SERVER_IP:3001`

## Step 6: Access the Application

Open your web browser and navigate to:
```
http://YOUR_SERVER_IP:3001
```

Replace `YOUR_SERVER_IP` with your Linux machine's IP address. If you're running locally, use `http://localhost:3001`.

## Using systemd for Production (Optional)

For production deployment, use systemd to run services automatically.

### Create Backend Service

```bash
sudo nano /etc/systemd/system/rlm-backend.service
```

Add the following content (replace paths with your actual paths):

```ini
[Unit]
Description=RLM Conversation Backend
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/RLM-Conversation
Environment="PYTHONPATH=/home/YOUR_USERNAME/RLM-Conversation"
ExecStart=/home/YOUR_USERNAME/RLM-Conversation/backend/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 9124
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Create Frontend Service

```bash
sudo nano /etc/systemd/system/rlm-frontend.service
```

Add the following content:

```ini
[Unit]
Description=RLM Conversation Frontend
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/RLM-Conversation/frontend
ExecStart=/usr/bin/npm run dev -- -p 3001 -- --host 0.0.0.0
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable rlm-backend
sudo systemctl enable rlm-frontend

# Start services
sudo systemctl start rlm-backend
sudo systemctl start rlm-frontend

# Check status
sudo systemctl status rlm-backend
sudo systemctl status rlm-frontend
```

## Using Screen (Simpler Alternative)

If you don't want to use systemd, you can use `screen` to keep processes running:

```bash
# Install screen
sudo apt install screen

# Start backend in screen
screen -S rlm-backend
cd /home/YOUR_USERNAME/RLM-Conversation
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 0.0.0.0 --port 9124
# Press Ctrl+A then D to detach

# Start frontend in screen
screen -S rlm-frontend
cd /home/YOUR_USERNAME/RLM-Conversation/frontend
npm run dev -- -p 3001 -- --host 0.0.0.0
# Press Ctrl+A then D to detach

# List screens
screen -ls

# Reattach to a screen
screen -r rlm-backend  # or rlm-frontend
```

## Firewall Configuration

If you have a firewall enabled, open the necessary ports:

```bash
# Using ufw (Ubuntu)
sudo ufw allow 9124/tcp
sudo ufw allow 3001/tcp

# Using iptables
sudo iptables -A INPUT -p tcp --dport 9124 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

## Troubleshooting

### Backend won't start
```bash
# Check if port is already in use
sudo lsof -i :9124

# Kill process if needed
sudo kill -9 <PID>

# Check backend logs
tail -f /var/log/syslog | grep rlm-backend
```

### Frontend won't start
```bash
# Check if port is already in use
sudo lsof -i :3001

# Kill process if needed
sudo kill -9 <PID>

# Rebuild frontend
cd frontend
npm run build
```

### API keys not working
```bash
# Verify .env file exists and contains keys
cat .env | grep API_KEY

# Restart services after changing .env
sudo systemctl restart rlm-backend
sudo systemctl restart rlm-frontend
```

### Connection refused
```bash
# Check if services are running
ps aux | grep uvicorn
ps aux | grep node

# Check backend health
curl http://localhost:9124/health
```

## Production Recommendations

For production deployments, consider:

1. **Use Nginx as a reverse proxy** to serve both frontend and backend under one domain
2. **Enable HTTPS** with Let's Encrypt SSL certificates
3. **Set up monitoring** with tools like Prometheus or Datadog
4. **Configure log rotation** to prevent disk space issues
5. **Use PM2** instead of npm for Node.js process management
6. **Build frontend for production**: `npm run build` and serve with nginx
7. **Set environment variables** in system environment, not .env file

## Quick Commands Reference

```bash
# Stop all services
sudo systemctl stop rlm-backend rlm-frontend

# Restart all services
sudo systemctl restart rlm-backend rlm-frontend

# View logs
sudo journalctl -u rlm-backend -f
sudo journalctl -u rlm-frontend -f

# Update application
cd RLM-Conversation
git pull
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cd frontend && npm install
sudo systemctl restart rlm-backend rlm-frontend
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs for error messages
3. Ensure all prerequisites are installed correctly
4. Verify API keys are valid and have credits
5. Check GitHub issues: https://github.com/YOUR_USERNAME/RLM-Conversation/issues
