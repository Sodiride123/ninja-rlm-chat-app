'use client';

import { useRef, useState } from 'react';
import type { DocumentInfo, ModelInfo, SessionInfo } from '@/lib/types';

interface DocumentPanelProps {
  documents: DocumentInfo[];
  models: ModelInfo[];
  selectedDocIds: string[];
  selectedModelId: string;
  currentSession: SessionInfo | null;
  sessionHistory: SessionInfo[];
  isProcessing: boolean;
  onUpload: (files: FileList) => void;
  onDeleteDocument: (docId: string) => void;
  onSelectDocument: (docId: string, selected: boolean) => void;
  onSelectModel: (modelId: string) => void;
  onCreateSession: () => void;
  onEndSession: () => void;
  onViewSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function DocumentPanel({
  documents,
  models,
  selectedDocIds,
  selectedModelId,
  currentSession,
  sessionHistory,
  isProcessing,
  onUpload,
  onDeleteDocument,
  onSelectDocument,
  onSelectModel,
  onCreateSession,
  onEndSession,
  onViewSession,
  onDeleteSession,
}: DocumentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Split sessions into active and ended (excluding current session from display)
  const activeSessions = sessionHistory.filter(
    s => s.status === 'active' && s.session_id !== currentSession?.session_id
  );
  const endedSessions = sessionHistory.filter(s => s.status === 'ended');

  return (
    <div className="flex flex-col h-full bg-surface-secondary border-r border-border-subtle">
      {/* Header */}
      <div className="p-5 border-b border-border-subtle bg-surface-primary">
        <h2 className="text-base font-semibold text-text-primary">RLM Web Chat</h2>
        <p className="text-sm text-text-tertiary mt-0.5">Document QA with Recursive LLMs</p>
      </div>

      {/* Model Selector */}
      <div className="p-4 border-b border-border-subtle">
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Model
        </label>
        <select
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
          disabled={!!currentSession || isProcessing}
          className="w-full px-3 py-2.5 bg-surface-primary border border-border rounded-lg text-sm text-text-primary
                     focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40
                     disabled:bg-surface-tertiary disabled:text-text-tertiary disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Documents</h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!!currentSession}
            className="px-2.5 py-1 text-xs font-medium text-accent-primary
                       rounded-md hover:bg-accent-subtle disabled:opacity-50
                       disabled:cursor-not-allowed transition-all duration-200"
          >
            + Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-text-secondary">No documents</p>
            <p className="text-xs text-text-tertiary mt-1">Upload PDF, TXT, MD, or DOCX</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`p-3 rounded-lg transition-all duration-200 ${
                  selectedDocIds.includes(doc.id)
                    ? 'bg-accent-subtle ring-1 ring-accent-primary/20'
                    : 'bg-surface-primary hover:bg-surface-hover shadow-soft'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(doc.id)}
                    onChange={(e) => onSelectDocument(doc.id, e.target.checked)}
                    disabled={!!currentSession}
                    className="mt-0.5 w-4 h-4 rounded border-border text-accent-primary
                               focus:ring-accent-primary/20 focus:ring-offset-0
                               disabled:cursor-not-allowed transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {formatBytes(doc.size_bytes)} · {doc.char_count.toLocaleString()} chars
                    </p>
                  </div>
                  {!currentSession && (
                    <button
                      onClick={() => onDeleteDocument(doc.id)}
                      className="text-text-tertiary hover:text-red-500 transition-colors p-1 -m-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Sessions (allows switching back) */}
      {activeSessions.length > 0 && (
        <div className="border-t border-border-subtle">
          <div className="px-4 py-3">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Active Sessions ({activeSessions.length})
            </span>
          </div>
          <div className="px-4 pb-3 space-y-2">
            {activeSessions.map((session) => (
              <div
                key={session.session_id}
                className="p-2.5 rounded-lg bg-green-50 hover:bg-green-100
                           cursor-pointer transition-all duration-200 border border-green-200"
                onClick={() => onViewSession(session.session_id)}
              >
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">
                      {session.title || 'Untitled session'}
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      {session.message_count} messages · {formatDate(session.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      {endedSessions.length > 0 && (
        <div className="border-t border-border-subtle">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-3 flex items-center justify-between text-left
                       hover:bg-surface-hover transition-colors"
          >
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              History ({endedSessions.length})
            </span>
            <svg
              className={`w-4 h-4 text-text-tertiary transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
              {endedSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="group p-2.5 rounded-lg bg-surface-primary hover:bg-surface-hover
                             cursor-pointer transition-all duration-200 shadow-soft"
                  onClick={() => onViewSession(session.session_id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {session.title || 'Untitled session'}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {session.message_count} messages · {formatDate(session.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.session_id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 -m-1
                                 text-text-tertiary hover:text-red-500 transition-all"
                      title="Delete permanently"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Controls */}
      <div className="p-4 border-t border-border-subtle bg-surface-primary">
        {currentSession ? (
          currentSession.status === 'ended' ? (
            // Viewing an ended session (read-only)
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <p className="text-sm font-medium text-amber-700">Viewing History</p>
                </div>
                <p className="text-xs text-amber-600 mt-1 ml-4 truncate" title={currentSession.title || undefined}>
                  {currentSession.title || 'Untitled session'}
                </p>
              </div>
              <button
                onClick={onEndSession}
                className="w-full px-4 py-2.5 text-sm font-medium text-text-secondary
                           bg-surface-secondary rounded-lg hover:bg-surface-hover
                           transition-all duration-200"
              >
                Close
              </button>
            </div>
          ) : (
            // Active session
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <p className="text-sm font-medium text-green-700">Session Active</p>
                </div>
                <p className="text-xs text-green-600 mt-1 ml-4">
                  {currentSession.document_ids.length} document{currentSession.document_ids.length !== 1 ? 's' : ''} loaded
                </p>
              </div>
              <button
                onClick={onEndSession}
                disabled={isProcessing}
                className="w-full px-4 py-2.5 text-sm font-medium text-red-600
                           bg-surface-secondary rounded-lg hover:bg-red-50
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
              >
                End Session
              </button>
            </div>
          )
        ) : (
          <button
            onClick={onCreateSession}
            disabled={isProcessing}
            className="w-full px-4 py-2.5 text-sm font-medium text-white
                       bg-accent-primary rounded-lg hover:bg-accent-primary-hover
                       disabled:bg-surface-tertiary disabled:text-text-tertiary disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {selectedDocIds.length === 0
              ? 'Start Chat'
              : `Start Session (${selectedDocIds.length} doc${selectedDocIds.length > 1 ? 's' : ''})`}
          </button>
        )}
      </div>
    </div>
  );
}
