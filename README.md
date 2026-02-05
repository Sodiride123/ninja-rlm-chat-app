# RLM-Conversation

Web-based AI chat application for ultra-long-context document understanding and QA, using [RLM (Recursive Language Models)](https://github.com/alexzhang13/rlm.git) as the core inference framework.

## Features

- **Document Upload**: Support for PDF, TXT, MD, and DOCX files
- **Multi-turn Conversations**: Uses RLM's native persistent mode to maintain conversation context across turns, with versioned context storage (context_0, context_1, etc.)
- **Real-time Progress**: Resizable progress panel with SSE-based incremental updates - events are emitted as each step completes (LLM response, code execution, sub-calls)
- **Model Selection**: Support for multiple providers - Claude (Sonnet 4.5, Opus 4.5) and OpenAI (GPT-5.2, GPT-5 Mini)
- **Session Management**: Create, manage, and delete chat sessions with seamless switching between active sessions. Running sessions show a purple indicator dot. Cancel running queries at any time.
- **Session History**: Persisted chat history with progress events - view past sessions, click messages to see RLM thinking process. Active sessions are preserved when browsing history and can be resumed.
- **ChatPDF-inspired UI**: Clean three-panel layout with resizable sidebar and progress panel, centered chat bubbles, purple accent theming, and warm sidebar typography
- **ChatGPT-style Composer**: Floating pill-shaped input with model selector, auto-growing textarea (Enter to send, Shift+Enter for newline)
- **Streamlined Sidebar**: Collapsible HISTORY section, "New" button for quick chat creation, warm color palette

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- LiteLLM proxy access (for Claude models) and/or OpenAI API key (for GPT models)

### 1. Setup Environment

```bash
cd RLM-Conversation

# Create .env from example
cp .env.example .env

# Edit .env and configure LiteLLM proxy for Claude models:
# ANTHROPIC_BASE_URL=http://your-litellm-proxy:4000
# ANTHROPIC_AUTH_TOKEN=sk-your-virtual-key
#
# For GPT models (optional):
# OPENAI_API_KEY=your-openai-key-here
```

### 2. Install Backend Dependencies

```bash
cd backend

# Create virtual environment with uv (recommended)
uv venv

# Activate the virtual environment
source .venv/bin/activate  # On macOS/Linux

# Install dependencies
uv pip install -r requirements.txt

# Install the RLM package from repo root (editable mode)
cd ..
pip install -e .
```

Or with standard pip:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
pip install -e .
```

### 3. Install Frontend Dependencies

```bash
cd frontend

# Install npm packages
npm install
```

### 4. Run the Application

**Terminal 1 - Backend (port 9124):**
```bash
cd RLM-Conversation
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 127.0.0.1 --port 9124
```

**Terminal 2 - Frontend (port 3001):**
```bash
cd RLM-Conversation/frontend
npm run dev
```

### 5. Open the App

Navigate to http://127.0.0.1:3001 in your browser.

## Usage

1. **Upload Documents**: Drag & drop into the purple-tinted upload area, or click to browse
2. **Select Documents**: Check one or more documents in the sidebar DOCUMENTS section
3. **Start Chat**: Click "Start Chat" to begin a session with selected documents
4. **Select Model**: Choose your model in the composer area (Claude Opus 4.5 default, or Sonnet 4.5 for faster responses)
5. **Ask Questions**: Type your question and watch the RLM Thinking Process panel show real-time progress
6. **Follow-up Questions**: Continue the conversation - context is preserved across turns
7. **New Chat**: Click the purple "New" button under CHATS to start another chat (current chat stays active)
8. **View History**: Expand the HISTORY section to browse past sessions
9. **End Chat**: Click the purple "End Chat" button in the sidebar when done

## Architecture

```
RLM-Conversation/
├── rlm/                       # RLM core library
│   ├── __init__.py            # Main RLM class
│   ├── clients/               # LLM provider clients (Anthropic, OpenAI, etc.)
│   ├── core/                  # Core RLM logic and types
│   ├── environments/          # Execution environments (local, docker, modal)
│   ├── logger/                # Logging utilities
│   └── utils/                 # Utilities and prompts
│
├── backend/                   # FastAPI backend
│   ├── main.py                # Application entry point
│   ├── config.py              # Settings and environment
│   ├── requirements.txt       # Python dependencies
│   ├── api/
│   │   ├── routes/            # API endpoints
│   │   │   ├── chat.py        # Chat & SSE streaming
│   │   │   ├── documents.py   # Document upload/management
│   │   │   ├── models.py      # Model listing
│   │   │   └── sessions.py    # Session management
│   │   └── schemas.py         # Pydantic models
│   └── services/
│       ├── document_service.py # Document parsing (PDF, DOCX, etc.)
│       ├── session_service.py  # Session & run state management
│       ├── rlm_service.py      # RLM execution wrapper
│       └── progress_emitter.py # Custom RLM logger for SSE
│
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Main application page
│   │   │   ├── layout.tsx     # Root layout
│   │   │   └── globals.css    # Global styles & animations
│   │   ├── components/
│   │   │   ├── Header.tsx     # Top navigation bar with logo
│   │   │   ├── Sidebar.tsx    # Left panel (chats, history, documents, New button)
│   │   │   ├── ChatPanel.tsx  # Chat messages UI with thinking indicator
│   │   │   ├── ProgressPanel.tsx # RLM Thinking Process visualization
│   │   │   ├── LandingPage.tsx   # Welcome/upload screen with branded headline
│   │   │   └── ResizeHandle.tsx  # Draggable panel resizer
│   │   ├── hooks/
│   │   │   └── useProgress.ts # SSE streaming hook
│   │   └── lib/
│   │       ├── api.ts         # API client
│   │       └── types.ts       # TypeScript types
│   ├── next.config.js         # Next.js config with API proxy
│   └── package.json
│
├── .env.example               # Environment template
├── pyproject.toml             # Python project config
└── LICENSE
```

## API Endpoints

### Documents
- `POST /api/documents/upload` - Upload documents (PDF, TXT, MD, DOCX)
- `GET /api/documents` - List all documents
- `DELETE /api/documents/{id}` - Delete a document

### Sessions
- `POST /api/sessions` - Create a chat session with selected documents
- `GET /api/sessions` - List all sessions
- `DELETE /api/sessions/{id}` - Delete a session

### Chat
- `POST /api/chat/{session_id}` - Submit a message (returns `run_id`)
- `GET /api/chat/{session_id}/stream/{run_id}` - SSE stream for real-time progress
- `GET /api/chat/{session_id}/history` - Get chat history

### Models
- `GET /api/models` - List available models

## SSE Progress Events

The progress panel displays real-time events from the RLM execution. Events are emitted **incrementally** as each step completes, providing continuous feedback during long-running operations:

| Event Type | Description |
|------------|-------------|
| `session_start` | Session initialized with model and document info |
| `thinking` | RLM is analyzing the document |
| `iteration_start` | RLM iteration beginning |
| `llm_response` | LLM response received |
| `code_start` | Code execution starting |
| `code_result` | Code execution completed |
| `subcall_complete` | Sub-LLM call completed |
| `final_answer` | Final answer produced |
| `usage_summary` | Token usage statistics |
| `error` | Error occurred |
| `done` | Stream complete |

## Configuration

Environment variables (set in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_BASE_URL` | LiteLLM proxy URL | (required for Claude models) |
| `ANTHROPIC_AUTH_TOKEN` | LiteLLM virtual key | (required for Claude models) |
| `OPENAI_API_KEY` | Your OpenAI API key | (required for GPT models) |
| `DEFAULT_MODEL` | Default model to use | `claude-opus-4-5-20251101` |
| `HOST` | Backend server host | `127.0.0.1` |
| `PORT` | Backend server port | `9124` |
| `RLM_MAX_ITERATIONS` | Max RLM iterations per query | `15` |
| `RLM_MAX_DEPTH` | Max recursion depth for sub-calls | `1` |
| `RLM_ENVIRONMENT` | RLM environment type | `local` |
| `RLM_SUBCALL_MODEL` | Model for sub-calls (optional) | (same as main) |
| `RLM_SUBCALL_BACKEND` | Backend for sub-calls: `openai` or `anthropic` | (same as main) |

### LiteLLM Proxy Configuration

Claude models are accessed via LiteLLM proxy. Set both `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`:

```bash
# LiteLLM proxy configuration (required for Claude models)
ANTHROPIC_BASE_URL=http://your-litellm-proxy:4000
ANTHROPIC_AUTH_TOKEN=sk-your-litellm-virtual-key
```

The LiteLLM proxy handles authentication and routing to the actual Anthropic API.

### Sub-call Model Configuration

By default, RLM uses the same model for both main queries and sub-calls (`llm_query` within code execution). To use a different (typically faster/cheaper) model for sub-calls, set these environment variables:

```bash
# Option 1: Use faster Claude model via LiteLLM (same proxy)
RLM_SUBCALL_MODEL=claude-sonnet-4-5-20250514
RLM_SUBCALL_BACKEND=anthropic

# Option 2: Use OpenAI directly (requires OPENAI_API_KEY)
RLM_SUBCALL_MODEL=gpt-5-nano-2025-08-07
RLM_SUBCALL_BACKEND=openai
```

When `RLM_SUBCALL_BACKEND=anthropic`, sub-calls use the same LiteLLM proxy (`ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`) as the main model.

This can significantly speed up queries that make many sub-calls, as smaller models respond faster. Both variables must be set to enable sub-call routing.

## Performance Notes

- **Query time**: Expect 1-5 minutes for complex queries on large documents
- **Iterations**: RLM typically uses 3-15 iterations depending on query complexity
- **Document size**: 45K+ character documents are supported
- **Model choice**: Sonnet 4.5 is faster; Opus 4.5 is more thorough

## Development

### Backend Development
```bash
cd RLM-Conversation
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --reload --host 127.0.0.1 --port 9124
```

### Frontend Development
```bash
cd frontend
npm run dev
```

The frontend proxies `/api/*` requests to the backend at `http://127.0.0.1:9124`.

## Restarting Servers

If you need to manually restart the servers (e.g., after a crash or code change):

### Check Running Processes

```bash
# Check if frontend is running (port 3001)
lsof -i :3001

# Check if backend is running (port 9124)
lsof -i :9124
```

### Stop Servers

```bash
# Kill frontend (replace PID with actual process ID from lsof output)
kill <frontend_pid>

# Kill backend
kill <backend_pid>

# Or kill by port
lsof -ti :3001 | xargs kill -9  # Kill frontend
lsof -ti :9124 | xargs kill -9  # Kill backend
```

### Restart Frontend

```bash
cd RLM-Conversation/frontend
npm run dev
```

### Restart Backend

```bash
cd RLM-Conversation
source backend/.venv/bin/activate
PYTHONPATH=$(pwd) uvicorn backend.main:app --host 127.0.0.1 --port 9124
```

## License

MIT
