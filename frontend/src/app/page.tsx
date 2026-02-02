'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DocumentPanel } from '@/components/DocumentPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { ProgressPanel } from '@/components/ProgressPanel';
import { ResizeHandle } from '@/components/ResizeHandle';
import { useProgress } from '@/hooks/useProgress';
import * as api from '@/lib/api';
import type { DocumentInfo, ModelInfo, SessionInfo, ChatMessage } from '@/lib/types';

// Panel width constraints
const MIN_LEFT_WIDTH = 200;
const MAX_LEFT_WIDTH = 500;
const MIN_RIGHT_WIDTH = 200;
const MAX_RIGHT_WIDTH = 600;
const DEFAULT_LEFT_WIDTH = 288; // 72 * 4 = 288px (w-72)
const DEFAULT_RIGHT_WIDTH = 320; // 80 * 4 = 320px (w-80)

export default function Home() {
  // Data state
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewingEndedSession, setViewingEndedSession] = useState(false);

  // UI state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  // Selected message's run_id for progress viewing
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Panel widths (resizable)
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_WIDTH);

  // Resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) => {
      const newWidth = prev + delta;
      return Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, newWidth));
    });
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) => {
      const newWidth = prev + delta;
      return Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, newWidth));
    });
  }, []);

  // Progress streaming hook - now stores all runs
  const {
    currentRunId,
    isStreaming,
    allProgress,
    getRunProgress,
    startStreaming,
    clearAllProgress,
    loadHistoricalProgress,
  } = useProgress({
    onFinalAnswer: (answer, runId) => {
      // Add the final answer as an assistant message with run_id
      const newMessage: ChatMessage = {
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
        run_id: runId,
      };
      setMessages((prev) => [...prev, newMessage]);
      setIsProcessing(false);
      // Auto-select the new message's progress
      setSelectedRunId(runId);
    },
    onError: async (error) => {
      // On SSE error, try to fetch chat history (RLM might have completed)
      if (currentSession) {
        try {
          const history = await api.getChatHistory(currentSession.session_id);
          if (history.length > messages.length) {
            // Add run_id to fetched messages if we have the current run
            const updatedHistory = history.map((msg, idx) => {
              if (msg.role === 'assistant' && idx === history.length - 1 && currentRunId) {
                return { ...msg, run_id: currentRunId };
              }
              return msg;
            });
            setMessages(updatedHistory);
            setIsProcessing(false);
            if (currentRunId) {
              setSelectedRunId(currentRunId);
            }
            return; // Success - don't show error
          }
        } catch {
          // Ignore fetch error
        }
      }
      setAppError(error);
      setIsProcessing(false);
    },
    onComplete: () => {
      setIsProcessing(false);
    },
  });

  // Get the progress to display - either selected or current streaming
  const displayRunId = selectedRunId || currentRunId;
  const displayProgress = useMemo(() => {
    if (!displayRunId) return null;
    return getRunProgress(displayRunId);
  }, [displayRunId, getRunProgress]);

  // Poll for completion if processing takes too long (fallback for SSE issues)
  useEffect(() => {
    if (!isProcessing || !currentSession || !currentRunId) return;

    const pollInterval = setInterval(async () => {
      try {
        const history = await api.getChatHistory(currentSession.session_id);
        // Check if we have a new assistant message
        const lastMessage = history[history.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && history.length > messages.length) {
          // Add run_id to the fetched message
          const updatedHistory = history.map((msg, idx) => {
            if (msg.role === 'assistant' && idx === history.length - 1) {
              return { ...msg, run_id: currentRunId };
            }
            return msg;
          });
          setMessages(updatedHistory);
          setIsProcessing(false);
          setSelectedRunId(currentRunId);
        }
      } catch {
        // Ignore poll errors
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [isProcessing, currentSession, currentRunId, messages.length]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [modelsData, docsData, sessionsData] = await Promise.all([
          api.getModels(),
          api.getDocuments(),
          api.getSessions(),
        ]);
        setModels(modelsData);
        setDocuments(docsData);
        setSessionHistory(sessionsData);
        if (modelsData.length > 0 && !selectedModelId) {
          // Default to Sonnet (second model) if available
          const defaultModel = modelsData.find(m => m.id.includes('sonnet')) || modelsData[0];
          setSelectedModelId(defaultModel.id);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setAppError('Failed to connect to backend. Is the server running?');
      }
    };
    loadInitialData();
  }, []);

  // Document handlers
  const handleUpload = useCallback(async (files: FileList) => {
    try {
      setAppError(null);
      const result = await api.uploadDocuments(files);
      setDocuments((prev) => [...prev, ...result.documents]);
      // Auto-select newly uploaded documents
      setSelectedDocIds((prev) => [...prev, ...result.documents.map((d) => d.id)]);
    } catch (error) {
      console.error('Upload failed:', error);
      setAppError(error instanceof Error ? error.message : 'Upload failed');
    }
  }, []);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, []);

  const handleSelectDocument = useCallback((docId: string, selected: boolean) => {
    setSelectedDocIds((prev) =>
      selected ? [...prev, docId] : prev.filter((id) => id !== docId)
    );
  }, []);

  // Session handlers
  const handleCreateSession = useCallback(async () => {
    try {
      setAppError(null);
      const session = await api.createSession(selectedModelId, selectedDocIds);
      setCurrentSession(session);
      setMessages([]);
      clearAllProgress();
      setSelectedRunId(null);
      setViewingEndedSession(false);
      // Refresh session list to include the new active session
      const sessions = await api.getSessions();
      setSessionHistory(sessions);
    } catch (error) {
      console.error('Failed to create session:', error);
      setAppError(error instanceof Error ? error.message : 'Failed to create session');
    }
  }, [selectedDocIds, selectedModelId, clearAllProgress]);

  const handleEndSession = useCallback(async () => {
    if (!currentSession) return;

    // If viewing an ended session, just close it (don't call API)
    if (currentSession.status === 'ended') {
      setCurrentSession(null);
      setMessages([]);
      clearAllProgress();
      setSelectedRunId(null);
      setViewingEndedSession(false);
      return;
    }

    // For active sessions, end them via API
    try {
      await api.endSession(currentSession.session_id);
    } catch (error) {
      console.error('Failed to end session:', error);
    }

    // Refresh session history to show the ended session
    try {
      const sessions = await api.getSessions();
      setSessionHistory(sessions);
    } catch {
      // Ignore refresh error
    }

    setCurrentSession(null);
    setMessages([]);
    clearAllProgress();
    setSelectedRunId(null);
    setIsProcessing(false);
    setViewingEndedSession(false);
  }, [currentSession, clearAllProgress]);

  // View a session (active or ended)
  const handleViewSession = useCallback(async (sessionId: string) => {
    try {
      setAppError(null);
      const { session, messages: sessionMessages } = await api.getSession(sessionId);
      setCurrentSession(session);
      setMessages(sessionMessages);
      // Only mark as read-only if session is ended
      setViewingEndedSession(session.status === 'ended');
      setIsProcessing(false);
      clearAllProgress();

      // Auto-select the last assistant message's run_id and load its progress
      const lastAssistantMsg = [...sessionMessages].reverse().find(m => m.role === 'assistant' && m.run_id);
      if (lastAssistantMsg?.run_id) {
        setSelectedRunId(lastAssistantMsg.run_id);
        // Load progress for this run
        try {
          const events = await api.getRunProgress(sessionId, lastAssistantMsg.run_id);
          if (events.length > 0) {
            loadHistoricalProgress(lastAssistantMsg.run_id, events as unknown as import('@/lib/types').ProgressEvent[]);
          }
        } catch {
          // Ignore progress load errors
        }
      } else {
        setSelectedRunId(null);
      }

      // Refresh session list to update message counts
      const sessions = await api.getSessions();
      setSessionHistory(sessions);
    } catch (error) {
      console.error('Failed to load session:', error);
      setAppError(error instanceof Error ? error.message : 'Failed to load session');
    }
  }, [clearAllProgress, loadHistoricalProgress]);

  // Permanently delete a session from history
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      setSessionHistory((prev) => prev.filter((s) => s.session_id !== sessionId));
      // If we're viewing the deleted session, clear it
      if (currentSession?.session_id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
        setViewingEndedSession(false);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [currentSession]);

  // Chat handler
  const handleSendMessage = useCallback(async (message: string) => {
    if (!currentSession || isProcessing) return;

    try {
      setAppError(null);
      setIsProcessing(true);

      // Add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Submit message and start streaming
      const { run_id } = await api.submitMessage(currentSession.session_id, message);

      // Auto-select the new run for viewing
      setSelectedRunId(run_id);

      startStreaming(currentSession.session_id, run_id);
    } catch (error) {
      console.error('Failed to send message:', error);
      setAppError(error instanceof Error ? error.message : 'Failed to send message');
      setIsProcessing(false);
    }
  }, [currentSession, isProcessing, startStreaming]);

  // Handle message selection in chat
  const handleSelectMessage = useCallback(async (runId: string | null) => {
    setSelectedRunId(runId);

    // If selecting a run and we don't have its progress, fetch it from API
    if (runId && currentSession && !getRunProgress(runId)) {
      try {
        const events = await api.getRunProgress(currentSession.session_id, runId);
        if (events.length > 0) {
          loadHistoricalProgress(runId, events as unknown as import('@/lib/types').ProgressEvent[]);
        }
      } catch (error) {
        console.error('Failed to load historical progress:', error);
      }
    }
  }, [currentSession, getRunProgress, loadHistoricalProgress]);

  return (
    <div className="h-screen flex flex-col bg-surface-secondary">
      {/* Error Banner */}
      {appError && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-red-600">{appError}</p>
          <button
            onClick={() => setAppError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Documents & Controls */}
        <div
          className="flex-shrink-0 h-full"
          style={{ width: leftPanelWidth }}
        >
          <DocumentPanel
            documents={documents}
            models={models}
            selectedDocIds={selectedDocIds}
            selectedModelId={selectedModelId}
            currentSession={currentSession}
            sessionHistory={sessionHistory}
            isProcessing={isProcessing}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onSelectDocument={handleSelectDocument}
            onSelectModel={setSelectedModelId}
            onCreateSession={handleCreateSession}
            onEndSession={handleEndSession}
            onViewSession={handleViewSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>

        {/* Left Resize Handle */}
        <ResizeHandle onResize={handleLeftResize} direction="left" />

        {/* Center - Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel
            messages={messages}
            isProcessing={isProcessing}
            hasSession={!!currentSession}
            isReadOnly={viewingEndedSession}
            selectedRunId={selectedRunId}
            onSendMessage={handleSendMessage}
            onSelectMessage={handleSelectMessage}
          />
        </div>

        {/* Right Resize Handle */}
        <ResizeHandle onResize={handleRightResize} direction="right" />

        {/* Right Panel - Progress */}
        <div
          className="flex-shrink-0 h-full"
          style={{ width: rightPanelWidth }}
        >
          <ProgressPanel
            events={displayProgress?.events || []}
            isStreaming={isStreaming && displayRunId === currentRunId}
            currentIteration={displayProgress?.currentIteration || 0}
            maxIterations={displayProgress?.maxIterations || 30}
            error={displayProgress?.error || null}
          />
        </div>
      </div>
    </div>
  );
}
