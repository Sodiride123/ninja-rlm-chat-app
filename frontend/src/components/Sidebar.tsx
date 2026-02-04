'use client';

import { useState, useRef } from 'react';
import type { DocumentInfo, SessionInfo } from '@/lib/types';

interface SidebarProps {
  documents: DocumentInfo[];
  selectedDocIds: string[];
  currentSession: SessionInfo | null;
  sessionHistory: SessionInfo[];
  isProcessing: boolean;
  runningSessionId: string | null; // Session ID that has an active RLM run (for purple dot indicator)
  onUpload: (files: FileList) => void;
  onDeleteDocument: (docId: string) => void;
  onSelectDocument: (docId: string, selected: boolean) => void;
  onEndSession: () => void;
  onViewSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function Sidebar({
  documents,
  selectedDocIds,
  currentSession,
  sessionHistory,
  isProcessing,
  runningSessionId,
  onUpload,
  onDeleteDocument,
  onSelectDocument,
  onEndSession,
  onViewSession,
  onDeleteSession,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEndedSessions, setShowEndedSessions] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  const activeSessions = sessionHistory.filter((s) => s.status === 'active');
  const endedSessions = sessionHistory.filter((s) => s.status === 'ended');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getSessionTitle = (session: SessionInfo) => {
    return session.title || `Chat ${session.session_id.slice(0, 8)}`;
  };

  return (
    <div className="h-full bg-[#f5f5f7] border-r border-border flex flex-col">
      {/* Chats Section */}
      <div className="flex-1 overflow-y-auto">
        {/* Section Header */}
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chats
          </div>
        </div>

        {/* Active Sessions */}
        <div className="px-2">
          {activeSessions.map((session) => {
            const isRunning = runningSessionId === session.session_id;
            return (
              <button
                key={session.session_id}
                onClick={() => onViewSession(session.session_id)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors group ${
                  currentSession?.session_id === session.session_id
                    ? 'bg-accent-subtle text-accent-primary'
                    : 'hover:bg-surface-tertiary text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Purple dot indicator for running chat */}
                    {isRunning && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                    )}
                    <span className="text-sm truncate">{getSessionTitle(session)}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {currentSession?.session_id === session.session_id && session.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEndSession();
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                        title="End session"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className={`text-xs text-text-tertiary mt-0.5 ${isRunning ? 'ml-4' : ''}`}>
                  {session.message_count} messages
                </div>
              </button>
            );
          })}

          {activeSessions.length === 0 && !currentSession && (
            <p className="text-xs text-text-tertiary px-3 py-2">No active chats</p>
          )}
        </div>

        {/* Ended Sessions (Collapsible) */}
        {endedSessions.length > 0 && (
          <div className="px-2 mt-2">
            <button
              onClick={() => setShowEndedSessions(!showEndedSessions)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showEndedSessions ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              History ({endedSessions.length})
            </button>

            {showEndedSessions && (
              <div className="mt-1">
                {endedSessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors group hover:bg-surface-tertiary ${
                      currentSession?.session_id === session.session_id
                        ? 'bg-surface-tertiary'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onViewSession(session.session_id)}
                        className="text-sm text-text-secondary truncate flex-1 text-left"
                      >
                        {getSessionTitle(session)}
                      </button>
                      <button
                        onClick={() => onDeleteSession(session.session_id)}
                        className="p-1 hover:bg-red-100 rounded text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete session"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="my-3 mx-3 border-t border-border" />

        {/* Documents Section */}
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Documents
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-surface-tertiary rounded transition-colors text-text-secondary hover:text-accent-primary"
              title="Upload document"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Document List */}
        <div className="px-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-2 px-3 py-2 rounded-lg transition-colors group hover:bg-surface-tertiary"
            >
              <input
                type="checkbox"
                checked={selectedDocIds.includes(doc.id)}
                onChange={(e) => onSelectDocument(doc.id, e.target.checked)}
                disabled={!!currentSession}
                className="mt-1 w-4 h-4 rounded border-border text-accent-primary focus:ring-accent-primary/20 disabled:opacity-50"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate text-text-primary">
                  {doc.filename}
                </p>
                <p className="text-xs text-text-tertiary">
                  {formatSize(doc.size_bytes)} · {doc.char_count?.toLocaleString() || '?'} chars
                </p>
              </div>
              <button
                onClick={() => onDeleteDocument(doc.id)}
                disabled={!!currentSession}
                className="p-1 hover:bg-red-100 rounded text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                title="Delete document"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          {documents.length === 0 && (
            <p className="text-xs text-text-tertiary px-3 py-2">No documents uploaded</p>
          )}
        </div>
      </div>

      {/* Bottom: Action Area */}
      <div className="p-3 border-t border-border">
        {!currentSession ? (
          /* Passive hint state - no button, just visual indicator */
          <div className="flex flex-col items-center py-4">
            {/* Document icons illustration */}
            <div className="relative w-24 h-16 mb-3">
              {/* Back document */}
              <div className="absolute left-0 top-2 w-10 h-12 bg-white rounded-lg shadow-sm border border-border flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9h4v2h-4v-2zm0 3h4v2h-4v-2z" />
                </svg>
              </div>
              {/* Middle document */}
              <div className="absolute left-7 top-0 w-10 h-12 bg-white rounded-lg shadow-sm border border-border flex items-center justify-center z-10">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9h4v2h-4v-2zm0 3h4v2h-4v-2z" />
                </svg>
              </div>
              {/* Front document */}
              <div className="absolute right-0 top-1 w-10 h-12 bg-white rounded-lg shadow-sm border border-border flex items-center justify-center z-20">
                <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9h4v2h-4v-2zm0 3h4v2h-4v-2z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-text-tertiary text-center">
              Select one or more documents to start
            </p>
          </div>
        ) : (
          /* End Chat button with purple background */
          <button
            onClick={onEndSession}
            disabled={isProcessing}
            className="w-full py-2.5 px-4 bg-accent-primary hover:bg-accent-primary-hover text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            End Chat
          </button>
        )}
      </div>
    </div>
  );
}
