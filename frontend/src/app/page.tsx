'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { ChatPanel } from '@/components/ChatPanel';
import { ProgressPanel } from '@/components/ProgressPanel';
import { LandingPage } from '@/components/LandingPage';
import { ResizeHandle } from '@/components/ResizeHandle';
import { useProgress } from '@/hooks/useProgress';
import * as api from '@/lib/api';
import type { DocumentInfo, ModelInfo, SessionInfo, ChatMessage } from '@/lib/types';

// Sidebar width constraints
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 390;

// Progress panel width constraints
const MIN_PROGRESS_WIDTH = 280;
const MAX_PROGRESS_WIDTH = 600;
const DEFAULT_PROGRESS_WIDTH = 384; // w-96 = 24rem = 384px

// Track active run state to preserve across session switches
interface ActiveRunState {
  sessionId: string;
  runId: string;
}

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

  // Progress panel state - only show after first message
  const [progressPanelExpanded, setProgressPanelExpanded] = useState(true);
  const hasMessages = messages.length > 0;

  // Session state cache - preserves messages when switching between sessions
  const [sessionMessagesCache, setSessionMessagesCache] = useState<Map<string, ChatMessage[]>>(new Map());

  // Track active run to preserve processing state across session switches
  const [activeRun, setActiveRun] = useState<ActiveRunState | null>(null);


  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((prev) => {
      const newWidth = prev + delta;
      return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth));
    });
  }, []);

  // Progress panel resize state
  const [progressWidth, setProgressWidth] = useState(DEFAULT_PROGRESS_WIDTH);

  const handleProgressResize = useCallback((delta: number) => {
    setProgressWidth((prev) => {
      const newWidth = prev + delta;
      return Math.min(MAX_PROGRESS_WIDTH, Math.max(MIN_PROGRESS_WIDTH, newWidth));
    });
  }, []);

  // Progress streaming hook - now stores all runs
  const {
    currentRunId,
    isStreaming,
    allProgress,
    getRunProgress,
    startStreaming,
    stopStreaming,
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
      setMessages((prev) => {
        const updated = [...prev, newMessage];
        // Also update the cache for this session
        if (activeRun?.sessionId) {
          setSessionMessagesCache((cache) => {
            const newCache = new Map(cache);
            newCache.set(activeRun.sessionId, updated);
            return newCache;
          });
        }
        return updated;
      });
      setIsProcessing(false);
      setActiveRun(null); // Clear active run when complete
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
            setActiveRun(null);
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
      setActiveRun(null);
    },
    onComplete: () => {
      setIsProcessing(false);
      setActiveRun(null);
    },
  });

  // Get the progress to display - priority logic:
  // 1. If user explicitly selected a run (historical), show that
  // 2. If no selection but streaming is active, show current run
  // 3. Otherwise show nothing
  const displayRunId = selectedRunId || (isStreaming ? currentRunId : null);
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
          // Default to Opus if available
          const defaultModel = modelsData.find(m => m.id.includes('opus')) || modelsData[0];
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

      // Check for duplicate filenames
      const existingFilenames = documents.map(d => d.filename.toLowerCase());
      const duplicates: string[] = [];
      const filesToUpload: File[] = [];

      Array.from(files).forEach((file) => {
        if (existingFilenames.includes(file.name.toLowerCase())) {
          duplicates.push(file.name);
        } else {
          filesToUpload.push(file);
        }
      });

      if (duplicates.length > 0) {
        setAppError(`Document${duplicates.length > 1 ? 's' : ''} with this name already exist${duplicates.length > 1 ? '' : 's'}: ${duplicates.join(', ')}`);
        if (filesToUpload.length === 0) {
          return;
        }
      }

      if (filesToUpload.length === 0) {
        return;
      }

      // Create a new FileList-like object from filtered files
      const dataTransfer = new DataTransfer();
      filesToUpload.forEach(file => dataTransfer.items.add(file));

      const result = await api.uploadDocuments(dataTransfer.files);
      setDocuments((prev) => [...prev, ...result.documents]);
      // Auto-select newly uploaded documents
      setSelectedDocIds((prev) => [...prev, ...result.documents.map((d) => d.id)]);
    } catch (error) {
      console.error('Upload failed:', error);
      setAppError(error instanceof Error ? error.message : 'Upload failed');
    }
  }, [documents]);

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

  // Helper: Refresh session list in background (non-blocking)
  const refreshSessionListInBackground = useCallback(() => {
    api.getSessions().then(setSessionHistory).catch(() => {
      // Silently ignore background refresh errors
    });
  }, []);

  // Session handlers
  const handleCreateSession = useCallback(async () => {
    // Optimistic UI: Show session active state immediately
    const tempSessionId = `temp-${Date.now()}`;
    const optimisticSession: SessionInfo = {
      session_id: tempSessionId,
      model_id: selectedModelId,
      document_ids: selectedDocIds,
      status: 'active',
      message_count: 0,
      created_at: new Date().toISOString(),
      ended_at: null,
      title: null,
    };

    // Update UI immediately (optimistic)
    setCurrentSession(optimisticSession);
    setMessages([]);
    clearAllProgress();
    setSelectedRunId(null);
    setViewingEndedSession(false);
    setAppError(null);

    try {
      // Create session in background - update with real session when ready
      const realSession = await api.createSession(selectedModelId, selectedDocIds);
      setCurrentSession(realSession);
      // Refresh session list in background (non-blocking)
      refreshSessionListInBackground();
    } catch (error) {
      // Rollback optimistic update on error
      console.error('Failed to create session:', error);
      setCurrentSession(null);
      setAppError(error instanceof Error ? error.message : 'Failed to create session');
    }
  }, [selectedDocIds, selectedModelId, clearAllProgress, refreshSessionListInBackground]);

  const handleEndSession = useCallback(async () => {
    if (!currentSession) return;

    // Stop any active streaming first
    stopStreaming();

    const wasActiveSession = currentSession.status === 'active';
    const sessionIdToEnd = currentSession.session_id;

    // Clear active run if this session had one
    if (activeRun?.sessionId === sessionIdToEnd) {
      setActiveRun(null);
    }

    // Remove from cache
    setSessionMessagesCache((cache) => {
      const newCache = new Map(cache);
      newCache.delete(sessionIdToEnd);
      return newCache;
    });

    // Optimistic UI: Clear session immediately (don't wait for API)
    setCurrentSession(null);
    setMessages([]);
    clearAllProgress();
    setSelectedRunId(null);
    setIsProcessing(false);
    setViewingEndedSession(false);

    // If it was an ended session, we're just closing the view - no API call needed
    if (!wasActiveSession) {
      return;
    }

    // For active sessions, end them via API in background (non-blocking)
    api.endSession(sessionIdToEnd)
      .then(() => {
        // Refresh session list in background after successful end
        refreshSessionListInBackground();
      })
      .catch((error) => {
        console.error('Failed to end session:', error);
        // Session is already cleared from UI, so just refresh the list
        refreshSessionListInBackground();
      });
  }, [currentSession, activeRun, clearAllProgress, stopStreaming, refreshSessionListInBackground]);

  // Stop the current thinking/reasoning turn only, keep session alive
  const handleStopThinking = useCallback(() => {
    // Stop any active streaming
    stopStreaming();

    // Clear processing state
    setIsProcessing(false);

    // Clear active run tracking
    setActiveRun(null);

    // Keep selectedRunId pointing to the interrupted run so user can see partial progress
    // Don't clear messages, session, or progress - just stop the current turn
  }, [stopStreaming]);

  // View a session (active or ended)
  const handleViewSession = useCallback(async (sessionId: string) => {
    try {
      setAppError(null);

      // Cache current session's messages before switching (if we have a current session)
      if (currentSession && messages.length > 0) {
        setSessionMessagesCache((cache) => {
          const newCache = new Map(cache);
          newCache.set(currentSession.session_id, messages);
          return newCache;
        });
      }

      // Check if we're returning to a session with an active run
      const isReturningToActiveRun = activeRun?.sessionId === sessionId;

      if (isReturningToActiveRun) {
        // Restore from cache - the run is still processing
        const cachedMessages = sessionMessagesCache.get(sessionId);
        if (cachedMessages) {
          // Restore cached messages
          setMessages(cachedMessages);
          // Restore the session (fetch fresh to get latest status)
          const { session } = await api.getSession(sessionId);
          setCurrentSession(session);
          setViewingEndedSession(false);
          setIsProcessing(true); // Re-enable processing indicator
          setSelectedRunId(activeRun.runId); // Re-select the active run
          // Progress is already in allProgress from the stream, no need to reload
          refreshSessionListInBackground();
          return;
        }
      }

      // Load core session data first (required for UI)
      const { session, messages: sessionMessages } = await api.getSession(sessionId);

      // Update UI immediately with session data
      setCurrentSession(session);
      setMessages(sessionMessages);
      setViewingEndedSession(session.status === 'ended');

      // Only set isProcessing to false if this session doesn't have an active run
      if (!isReturningToActiveRun) {
        setIsProcessing(false);
      }

      // Don't clear all progress - just load this session's progress
      // This preserves the streaming progress for the active run

      // Auto-select the last assistant message's run_id
      const lastAssistantMsg = [...sessionMessages].reverse().find(m => m.role === 'assistant' && m.run_id);
      if (lastAssistantMsg?.run_id) {
        setSelectedRunId(lastAssistantMsg.run_id);
        // Load progress in background (non-blocking) - UI is already shown
        // Only load if we don't already have it (streaming run progress is already stored)
        if (!getRunProgress(lastAssistantMsg.run_id)) {
          api.getRunProgress(sessionId, lastAssistantMsg.run_id)
            .then((events) => {
              if (events.length > 0) {
                loadHistoricalProgress(lastAssistantMsg.run_id!, events as unknown as import('@/lib/types').ProgressEvent[]);
              }
            })
            .catch(() => {
              // Ignore progress load errors
            });
        }
      } else {
        setSelectedRunId(null);
      }

      // Refresh session list in background (non-blocking)
      refreshSessionListInBackground();
    } catch (error) {
      console.error('Failed to load session:', error);
      setAppError(error instanceof Error ? error.message : 'Failed to load session');
    }
  }, [currentSession, messages, activeRun, sessionMessagesCache, getRunProgress, loadHistoricalProgress, refreshSessionListInBackground]);

  // Permanently delete a session from history
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      setSessionHistory((prev) => prev.filter((s) => s.session_id !== sessionId));

      // Clear from cache
      setSessionMessagesCache((cache) => {
        const newCache = new Map(cache);
        newCache.delete(sessionId);
        return newCache;
      });

      // Clear active run if this session had one
      if (activeRun?.sessionId === sessionId) {
        setActiveRun(null);
        stopStreaming();
      }

      // If we're viewing the deleted session, clear it
      if (currentSession?.session_id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
        setViewingEndedSession(false);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [currentSession, activeRun, stopStreaming]);

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
      setMessages((prev) => {
        const updated = [...prev, userMessage];
        // Cache the messages for this session
        setSessionMessagesCache((cache) => {
          const newCache = new Map(cache);
          newCache.set(currentSession.session_id, updated);
          return newCache;
        });
        return updated;
      });

      // Submit message and start streaming
      const { run_id } = await api.submitMessage(currentSession.session_id, message);

      // Track the active run for state preservation
      setActiveRun({ sessionId: currentSession.session_id, runId: run_id });

      // Auto-select the new run for viewing
      setSelectedRunId(run_id);

      startStreaming(currentSession.session_id, run_id);
    } catch (error) {
      console.error('Failed to send message:', error);
      setAppError(error instanceof Error ? error.message : 'Failed to send message');
      setIsProcessing(false);
      setActiveRun(null);
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

  // Navigate to landing page to start a new chat (without ending current session)
  const handleNewChat = useCallback(() => {
    // Cache current session's messages before leaving (if we have a current session with messages)
    if (currentSession && messages.length > 0) {
      setSessionMessagesCache((cache) => {
        const newCache = new Map(cache);
        newCache.set(currentSession.session_id, messages);
        return newCache;
      });
    }

    // Clear current view to show landing page
    setCurrentSession(null);
    setMessages([]);
    clearAllProgress();
    setSelectedRunId(null);
    setViewingEndedSession(false);
    setAppError(null);
    // Note: We don't stop streaming or clear activeRun - the run continues in background
  }, [currentSession, messages, clearAllProgress]);

  // Toggle progress panel
  const toggleProgressPanel = useCallback(() => {
    setProgressPanelExpanded((prev) => !prev);
  }, []);


  // Auto-expand progress panel when streaming starts (only if we have messages)
  useEffect(() => {
    if (isStreaming && hasMessages) {
      setProgressPanelExpanded(true);
    }
  }, [isStreaming, hasMessages]);

  return (
    <div className="h-screen flex flex-col bg-surface-secondary">
      {/* Header */}
      <Header
        sessionTitle={currentSession?.title}
        hasActiveSession={!!currentSession}
        logoSrc="/logo.png"
        onNavigateHome={handleNewChat}
      />

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

      {/* Main Layout - Two Column */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div
          className="flex-shrink-0 h-full"
          style={{ width: sidebarWidth }}
        >
          <Sidebar
            documents={documents}
            selectedDocIds={selectedDocIds}
            currentSession={currentSession}
            sessionHistory={sessionHistory}
            isProcessing={isProcessing}
            runningSessionId={activeRun?.sessionId || null}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onSelectDocument={handleSelectDocument}
            onStopThinking={handleStopThinking}
            onEndSession={handleEndSession}
            onViewSession={handleViewSession}
            onDeleteSession={handleDeleteSession}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Sidebar Resize Handle */}
        <ResizeHandle onResize={handleSidebarResize} direction="left" />

        {/* Main Content - Chat or Landing Page */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {currentSession ? (
            <>
              <ChatPanel
                messages={messages}
                isProcessing={isProcessing}
                hasSession={!!currentSession}
                isReadOnly={viewingEndedSession}
                selectedRunId={selectedRunId}
                onSendMessage={handleSendMessage}
                onSelectMessage={handleSelectMessage}
                onToggleProgress={toggleProgressPanel}
                showProgressButton={hasMessages}
                progressPanelExpanded={progressPanelExpanded && hasMessages}
                models={models}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
              />
            </>
          ) : (
            <LandingPage
              onUpload={handleUpload}
              hasDocuments={documents.length > 0}
              selectedDocCount={selectedDocIds.length}
              onStartSession={handleCreateSession}
            />
          )}
        </div>

        {/* Right Panel - Progress (only after first message) */}
        {currentSession && hasMessages && progressPanelExpanded && (
          <>
            {/* Progress Panel Resize Handle */}
            <ResizeHandle onResize={handleProgressResize} direction="right" />

            <div
              className="flex-shrink-0 h-full bg-panel-bg border-l border-panel-border relative"
              style={{ width: progressWidth }}
            >
              {/* Collapse button */}
              <button
                onClick={toggleProgressPanel}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-panel-surface hover:bg-panel-surface-hover text-panel-text-secondary hover:text-panel-text transition-colors"
                title="Collapse progress panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
              <ProgressPanel
                events={displayProgress?.events || []}
                isStreaming={isStreaming && displayRunId === currentRunId}
                currentIteration={displayProgress?.currentIteration || 0}
                maxIterations={displayProgress?.maxIterations || 30}
                error={displayProgress?.error || null}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
