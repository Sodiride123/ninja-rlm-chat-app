// API Types

export interface DocumentInfo {
  id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
  char_count: number;
  uploaded_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
}

export type SessionStatus = 'active' | 'ended';

export interface SessionInfo {
  session_id: string;
  model_id: string;
  document_ids: string[];
  title: string | null;
  status: SessionStatus;
  created_at: string;
  ended_at: string | null;
  message_count: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  run_id?: string; // For assistant messages, links to progress events
}

// Progress Events
export type ProgressEventType =
  | 'session_start'
  | 'thinking'
  | 'iteration_start'
  | 'llm_response'
  | 'code_start'
  | 'code_result'
  | 'subcall_start'
  | 'subcall_complete'
  | 'final_answer'
  | 'usage_summary'
  | 'error'
  | 'done'
  | 'heartbeat';

export interface BaseProgressEvent {
  type: ProgressEventType;
  timestamp: string;
  session_id: string;
  run_id: string;
}

export interface SessionStartEvent extends BaseProgressEvent {
  type: 'session_start';
  model: string;
  document_count?: number;
  total_chars?: number;
  max_iterations?: number;
  max_depth?: number;
  backend?: string;
  environment?: string;
}

export interface ThinkingEvent extends BaseProgressEvent {
  type: 'thinking';
  message: string;
  max_iterations?: number;
}

export interface IterationStartEvent extends BaseProgressEvent {
  type: 'iteration_start';
  iteration: number;
  max_iterations: number;
}

export interface LLMResponseEvent extends BaseProgressEvent {
  type: 'llm_response';
  iteration: number;
  response: string;
  time_ms: number;
}

export interface CodeStartEvent extends BaseProgressEvent {
  type: 'code_start';
  iteration: number;
  code: string;
}

export interface CodeResultEvent extends BaseProgressEvent {
  type: 'code_result';
  iteration: number;
  stdout: string;
  stderr: string;
  time_ms: number;
  subcall_count: number;
}

export interface SubcallCompleteEvent extends BaseProgressEvent {
  type: 'subcall_complete';
  iteration: number;
  model: string;
  response_preview: string;
  time_ms: number;
}

export interface FinalAnswerEvent extends BaseProgressEvent {
  type: 'final_answer';
  answer: string;
  total_iterations: number;
  total_time_ms: number;
}

export interface UsageSummaryEvent extends BaseProgressEvent {
  type: 'usage_summary';
  input_tokens: number;
  output_tokens: number;
  models_used: string[];
  execution_time_ms?: number;
}

export interface ErrorEvent extends BaseProgressEvent {
  type: 'error';
  message: string;
  code: string;
  traceback?: string;
}

export interface DoneEvent extends BaseProgressEvent {
  type: 'done';
}

export type ProgressEvent =
  | SessionStartEvent
  | ThinkingEvent
  | IterationStartEvent
  | LLMResponseEvent
  | CodeStartEvent
  | CodeResultEvent
  | SubcallCompleteEvent
  | FinalAnswerEvent
  | UsageSummaryEvent
  | ErrorEvent
  | DoneEvent;

