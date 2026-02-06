// API Client for RLM Web Chat Backend

import type {
  DocumentInfo,
  ModelInfo,
  SessionInfo,
  ChatMessage,
} from './types';

const API_BASE = '/api';

// Debug timing: Enable in browser console with `window.DEBUG_API_TIMING = true`
declare global {
  interface Window {
    DEBUG_API_TIMING?: boolean;
  }
}

function logTiming(label: string, startTime: number) {
  if (typeof window !== 'undefined' && window.DEBUG_API_TIMING) {
    console.log(`[API Timing] ${label}: ${Date.now() - startTime}ms`);
  }
}

// Helper for fetch with error handling
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// Health Check
export async function checkHealth(): Promise<{
  status: string;
  api_key_configured: boolean;
  version: string;
}> {
  const response = await fetch('/health');
  return response.json();
}

// Models
export async function getModels(): Promise<ModelInfo[]> {
  const data = await fetchAPI<{ models: ModelInfo[] }>('/models');
  return data.models;
}

// Documents
export async function uploadDocuments(files: FileList): Promise<{
  documents: DocumentInfo[];
  total_chars: number;
}> {
  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function getDocuments(): Promise<DocumentInfo[]> {
  const data = await fetchAPI<{ documents: DocumentInfo[]; total_count: number }>('/documents');
  return data.documents;
}

export async function deleteDocument(docId: string): Promise<void> {
  await fetchAPI(`/documents/${docId}`, { method: 'DELETE' });
}

// Sessions
export async function createSession(
  modelId: string,
  documentIds: string[]
): Promise<SessionInfo> {
  const start = Date.now();
  const result = await fetchAPI<SessionInfo>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, document_ids: documentIds }),
  });
  logTiming('createSession', start);
  return result;
}

export async function getSessions(status?: 'active' | 'ended'): Promise<SessionInfo[]> {
  const start = Date.now();
  const query = status ? `?status=${status}` : '';
  const result = await fetchAPI<SessionInfo[]>(`/sessions${query}`);
  logTiming('getSessions', start);
  return result;
}

export async function getSession(sessionId: string): Promise<{
  session: SessionInfo;
  messages: ChatMessage[];
}> {
  const start = Date.now();
  const result = await fetchAPI<{ session: SessionInfo; messages: ChatMessage[] }>(`/sessions/${sessionId}`);
  logTiming('getSession', start);
  return result;
}

export async function endSession(sessionId: string): Promise<void> {
  const start = Date.now();
  await fetchAPI(`/sessions/${sessionId}/end`, { method: 'POST' });
  logTiming('endSession', start);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetchAPI(`/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  await fetchAPI(`/sessions/${sessionId}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function updateSessionModel(
  sessionId: string,
  modelId: string
): Promise<void> {
  await fetchAPI(`/sessions/${sessionId}/model`, {
    method: 'PATCH',
    body: JSON.stringify({ model_id: modelId }),
  });
}

// Chat
export async function submitMessage(
  sessionId: string,
  message: string
): Promise<{ run_id: string }> {
  return fetchAPI<{ run_id: string; message: string }>(`/chat/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getChatHistory(sessionId: string): Promise<ChatMessage[]> {
  const data = await fetchAPI<{ session_id: string; messages: ChatMessage[] }>(
    `/chat/${sessionId}/history`
  );
  return data.messages;
}

export async function getRunProgress(sessionId: string, runId: string): Promise<Record<string, unknown>[]> {
  const start = Date.now();
  const data = await fetchAPI<{ session_id: string; run_id: string; events: Record<string, unknown>[] }>(
    `/chat/${sessionId}/progress/${runId}`
  );
  logTiming('getRunProgress', start);
  return data.events;
}

// SSE Stream URL (for EventSource)
// Connect directly to backend to avoid Next.js proxy buffering SSE responses
const SSE_BASE = typeof window !== 'undefined'
  ? 'http://127.0.0.1:9124/api'  // Direct backend connection for SSE
  : '/api';
//const SSE_BASE = '/api';

export function getStreamUrl(sessionId: string, runId: string): string {
  return `${SSE_BASE}/chat/${sessionId}/stream/${runId}`;
}
