'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProgressEvent } from '@/lib/types';
import { getStreamUrl } from '@/lib/api';

interface UseProgressOptions {
  onFinalAnswer?: (answer: string, runId: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

interface RunProgress {
  events: ProgressEvent[];
  currentIteration: number;
  maxIterations: number;
  error: string | null;
  isComplete: boolean;
}

interface UseProgressReturn {
  // Current streaming state
  currentRunId: string | null;
  isStreaming: boolean;

  // All stored progress by run_id
  allProgress: Map<string, RunProgress>;

  // Get events for a specific run
  getRunProgress: (runId: string) => RunProgress | null;

  // Actions
  startStreaming: (sessionId: string, runId: string) => void;
  stopStreaming: () => void;
  clearAllProgress: () => void;
  loadHistoricalProgress: (runId: string, events: ProgressEvent[]) => void;
}

const DEFAULT_RUN_PROGRESS: RunProgress = {
  events: [],
  currentIteration: 0,
  maxIterations: 30,
  error: null,
  isComplete: false,
};

export function useProgress(options: UseProgressOptions = {}): UseProgressReturn {
  // Store all progress by run_id
  const [allProgress, setAllProgress] = useState<Map<string, RunProgress>>(new Map());
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearAllProgress = useCallback(() => {
    setAllProgress(new Map());
    setCurrentRunId(null);
  }, []);

  const getRunProgress = useCallback((runId: string): RunProgress | null => {
    return allProgress.get(runId) || null;
  }, [allProgress]);

  const loadHistoricalProgress = useCallback((runId: string, events: ProgressEvent[]) => {
    // Process events to extract metadata
    let currentIteration = 0;
    let maxIterations = 30;
    let error: string | null = null;

    for (const event of events) {
      if ('iteration' in event && typeof event.iteration === 'number') {
        currentIteration = event.iteration;
      }
      if ('max_iterations' in event && typeof event.max_iterations === 'number') {
        maxIterations = event.max_iterations;
      }
      if (event.type === 'error' && 'message' in event) {
        error = event.message as string;
      }
    }

    setAllProgress((prev) => {
      const next = new Map(prev);
      next.set(runId, {
        events,
        currentIteration,
        maxIterations,
        error,
        isComplete: true,
      });
      return next;
    });
  }, []);

  const startStreaming = useCallback((sessionId: string, runId: string) => {
    // Close any existing connection
    stopStreaming();

    // Initialize progress for this run
    setAllProgress((prev) => {
      const next = new Map(prev);
      next.set(runId, { ...DEFAULT_RUN_PROGRESS });
      return next;
    });

    setCurrentRunId(runId);
    setIsStreaming(true);

    const url = getStreamUrl(sessionId, runId);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressEvent;

        // Update progress for this run
        setAllProgress((prev) => {
          const next = new Map(prev);
          const runProgress = next.get(runId) || { ...DEFAULT_RUN_PROGRESS };

          // Add event
          const updatedEvents = [...runProgress.events, data];

          // Update iteration tracking
          let newIteration = runProgress.currentIteration;
          let newMaxIterations = runProgress.maxIterations;
          let newError = runProgress.error;
          let isComplete = runProgress.isComplete;

          if ('iteration' in data && typeof data.iteration === 'number') {
            newIteration = data.iteration;
          }
          if ('max_iterations' in data && typeof data.max_iterations === 'number') {
            newMaxIterations = data.max_iterations;
          }
          if (data.type === 'thinking') {
            newIteration = 0;
          }
          if (data.type === 'error') {
            newError = data.message;
          }
          if (data.type === 'done' || data.type === 'final_answer') {
            isComplete = true;
          }

          next.set(runId, {
            events: updatedEvents,
            currentIteration: newIteration,
            maxIterations: newMaxIterations,
            error: newError,
            isComplete,
          });

          return next;
        });

        // Handle specific event types
        switch (data.type) {
          case 'final_answer':
            optionsRef.current.onFinalAnswer?.(data.answer, runId);
            break;
          case 'error':
            optionsRef.current.onError?.(data.message);
            break;
          case 'done':
            stopStreaming();
            optionsRef.current.onComplete?.();
            break;
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE error:', e);

      // Update error state for this run
      setAllProgress((prev) => {
        const next = new Map(prev);
        const runProgress = next.get(runId) || { ...DEFAULT_RUN_PROGRESS };
        next.set(runId, {
          ...runProgress,
          error: 'Connection error',
        });
        return next;
      });

      stopStreaming();
    };
  }, [stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    currentRunId,
    isStreaming,
    allProgress,
    getRunProgress,
    startStreaming,
    stopStreaming,
    clearAllProgress,
    loadHistoricalProgress,
  };
}
