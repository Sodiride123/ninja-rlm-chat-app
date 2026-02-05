# Deploy Dependencies

Prepare a VM image with all dependencies pre-installed. This image can be shared and reused.

## Prerequisites

- Linux VM (Ubuntu 22.04+ recommended)
- Python 3.11+
- Node.js 18+
- Git

## Steps

```bash
# 1. Clone the repository
cd ~
git clone https://github.com/Sodiride123/ninja-rlm-chat-app.git
cd ninja-rlm-chat-app

# 2. Install backend dependencies
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
pip install -e .
deactivate

# 3. Install frontend dependencies
cd frontend
npm install
cd ..
```

## Verification

Verify the installation completed successfully:

```bash
# Check backend venv exists
ls ~/ninja-rlm-chat-app/backend/.venv/bin/python

# Check frontend node_modules exists
ls ~/ninja-rlm-chat-app/frontend/node_modules
```
