'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ProgressEvent } from '@/lib/types';

interface ProgressPanelProps {
  events: ProgressEvent[];
  isStreaming: boolean;
  currentIteration: number;
  maxIterations: number;
  error: string | null;
}

export function ProgressPanel({
  events,
  isStreaming,
  currentIteration,
  error,
}: ProgressPanelProps) {
  // Track which events are expanded
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  // Track previous event count to identify new events for animation
  const prevEventCount = useRef(0);
  const [newEventStartIndex, setNewEventStartIndex] = useState(-1);

  // Smart auto-scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  // Toggle event expansion
  const toggleEvent = (index: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Check if scrolled to bottom (with small threshold)
  const checkIfAtBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    setShowJumpButton(!atBottom && events.length > 0);
  }, [checkIfAtBottom, events.length]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    eventsEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setIsAtBottom(true);
    setShowJumpButton(false);
  }, []);

  // Auto-scroll when new events arrive (only if at bottom)
  useEffect(() => {
    if (isAtBottom && events.length > 0) {
      scrollToBottom();
    } else if (events.length > 0 && !isAtBottom) {
      setShowJumpButton(true);
    }
  }, [events.length, isAtBottom, scrollToBottom]);

  // Reset scroll state when events are cleared
  useEffect(() => {
    if (events.length === 0) {
      setIsAtBottom(true);
      setShowJumpButton(false);
    }
  }, [events.length]);

  // Ensure events is always an array
  const safeEvents = events || [];

  // Memoize: Filter out heartbeat events
  const visibleEvents = useMemo(
    () => safeEvents.filter(e => (e.type as string) !== 'heartbeat'),
    [safeEvents]
  );

  // Update new event tracking when events change
  useEffect(() => {
    const currentCount = visibleEvents.length;
    if (currentCount > prevEventCount.current) {
      // New events arrived - mark where they start for animation
      setNewEventStartIndex(prevEventCount.current);

      // Clear animation state after animation completes
      const timer = setTimeout(() => {
        setNewEventStartIndex(-1);
      }, 500); // Animation duration + buffer

      prevEventCount.current = currentCount;
      return () => clearTimeout(timer);
    }
    prevEventCount.current = currentCount;
  }, [visibleEvents.length]);

  // Reset tracking when events are cleared (new run)
  useEffect(() => {
    if (visibleEvents.length === 0) {
      prevEventCount.current = 0;
      setNewEventStartIndex(-1);
    }
  }, [visibleEvents.length]);

  // Memoize: Single-pass status computation (instead of multiple .some()/.find() calls)
  const { hasFinalAnswer, finalAnswerEvent, status } = useMemo(() => {
    let finalAnswer: ProgressEvent | null = null;
    let foundError = false;

    for (const event of visibleEvents) {
      if (event.type === 'final_answer' && !finalAnswer) {
        finalAnswer = event;
      }
      if (event.type === 'error') {
        foundError = true;
      }
    }

    const hasFinal = finalAnswer !== null;
    const hasErr = foundError || !!error;

    let computedStatus: 'error' | 'complete' | 'live' | 'idle' | 'empty';
    if (hasErr) computedStatus = 'error';
    else if (hasFinal) computedStatus = 'complete';
    else if (isStreaming) computedStatus = 'live';
    else if (visibleEvents.length > 0) computedStatus = 'idle';
    else computedStatus = 'empty';

    return {
      hasFinalAnswer: hasFinal,
      finalAnswerEvent: finalAnswer as (ProgressEvent & { type: 'final_answer'; total_iterations: number; total_time_ms: number }) | null,
      status: computedStatus,
    };
  }, [visibleEvents, error, isStreaming]);

  // Memoize: Filter to show only important events - O(n) single-pass
  const displayEvents = useMemo(() => {
    let hasSeenSessionStart = false;
    const result: ProgressEvent[] = [];
    for (const event of visibleEvents) {
      if (event.type === 'session_start') {
        if (hasSeenSessionStart) continue;
        hasSeenSessionStart = true;
      }
      if (event.type === 'done') continue;
      result.push(event);
    }
    return result;
  }, [visibleEvents]);

  // Pre-compute mapping from displayEvent index to visibleEvent index (O(n) once)
  const displayToVisibleIndexMap = useMemo(() => {
    const map: number[] = [];
    let hasSeenSessionStart = false;
    for (let i = 0; i < visibleEvents.length; i++) {
      const event = visibleEvents[i];
      if (event.type === 'session_start') {
        if (hasSeenSessionStart) continue;
        hasSeenSessionStart = true;
      }
      if (event.type === 'done') continue;
      map.push(i);
    }
    return map;
  }, [visibleEvents]);

  // Get animation class - now O(1) lookup instead of O(n²)
  const getAnimationClass = useCallback((displayIndex: number) => {
    if (newEventStartIndex < 0) return '';
    const visibleIndex = displayToVisibleIndexMap[displayIndex] ?? 0;
    if (visibleIndex >= newEventStartIndex) {
      const staggerIndex = Math.min(visibleIndex - newEventStartIndex + 1, 5);
      return `animate-slide-in animate-stagger-${staggerIndex}`;
    }
    return '';
  }, [newEventStartIndex, displayToVisibleIndexMap]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get icon for event type - clean SVG icons
  const getEventIcon = (type: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'session_start':
        return (
          <svg className={`${iconClass} text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'thinking':
        return (
          <svg className={`${iconClass} text-purple-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'iteration_start':
        return (
          <svg className={`${iconClass} text-cyan-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'llm_response':
        return (
          <svg className={`${iconClass} text-amber-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'code_start':
        return (
          <svg className={`${iconClass} text-emerald-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'code_result':
        return (
          <svg className={`${iconClass} text-green-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'subcall_complete':
        return (
          <svg className={`${iconClass} text-indigo-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        );
      case 'final_answer':
        return (
          <svg className={`${iconClass} text-green-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'usage_summary':
        return (
          <svg className={`${iconClass} text-slate-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'error':
        return (
          <svg className={`${iconClass} text-red-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'done':
        return (
          <svg className={`${iconClass} text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} text-slate-500`} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
          </svg>
        );
    }
  };

  // Get event summary text (collapsed view)
  const getEventSummary = (event: ProgressEvent): string => {
    switch (event.type) {
      case 'session_start':
        if ('document_count' in event) {
          return `Session started (${event.document_count} doc${event.document_count !== 1 ? 's' : ''}, ${event.total_chars?.toLocaleString()} chars)`;
        }
        return `Model: ${event.model}`;
      case 'thinking':
        return event.message || 'Analyzing document...';
      case 'iteration_start':
        return `Starting iteration ${event.iteration}`;
      case 'llm_response':
        const preview = event.response.substring(0, 100);
        return `LLM response (${event.time_ms}ms): ${preview}${event.response.length > 100 ? '...' : ''}`;
      case 'code_start':
        return `Executing: ${event.code.split('\n')[0].substring(0, 50)}...`;
      case 'code_result':
        const output = event.stdout || event.stderr || '(no output)';
        return `Result: ${output.substring(0, 80)}${output.length > 80 ? '...' : ''}`;
      case 'subcall_complete':
        return `Sub-call to ${event.model} (${event.time_ms}ms)`;
      case 'final_answer':
        return `Answer found in ${event.total_iterations} iteration${event.total_iterations !== 1 ? 's' : ''} (${(event.total_time_ms / 1000).toFixed(1)}s)`;
      case 'usage_summary':
        return `Tokens: ${event.input_tokens.toLocaleString()} in / ${event.output_tokens.toLocaleString()} out`;
      case 'error':
        return `Error: ${event.message}`;
      case 'done':
        return 'Stream complete';
      default:
        return (event as { type: string }).type;
    }
  };

  // Check if event has expandable details
  const hasDetails = (event: ProgressEvent): boolean => {
    switch (event.type) {
      case 'llm_response':
        return Boolean(event.response && event.response.length > 100);
      case 'code_start':
        return Boolean(event.code && event.code.length > 0);
      case 'code_result':
        return Boolean(event.stdout && event.stdout.length > 80) ||
               Boolean(event.stderr && event.stderr.length > 0);
      case 'error':
        return 'traceback' in event && !!event.traceback;
      case 'session_start':
        return true;
      case 'usage_summary':
        return 'models_used' in event;
      case 'subcall_complete':
        return 'response' in event && !!event.response;
      default:
        return false;
    }
  };

  // Render expanded details for an event
  const renderDetails = (event: ProgressEvent) => {
    switch (event.type) {
      case 'session_start':
        return (
          <div className="space-y-1.5">
            <DetailRow label="Model" value={event.model} />
            {'document_count' in event && (
              <>
                <DetailRow label="Documents" value={String(event.document_count)} />
                <DetailRow label="Total chars" value={event.total_chars?.toLocaleString() || 'N/A'} />
              </>
            )}
            <DetailRow label="Session ID" value={event.session_id} mono />
            <DetailRow label="Run ID" value={event.run_id} mono />
          </div>
        );

      case 'llm_response':
        return (
          <div className="space-y-2">
            <DetailRow label="Time" value={`${event.time_ms}ms`} />
            <div>
              <span className="text-panel-text-secondary">Full response:</span>
              <pre className="mt-1.5 p-2.5 bg-black/30 rounded-md text-panel-text text-xs whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
                {event.response}
              </pre>
            </div>
          </div>
        );

      case 'code_start':
        return (
          <div>
            <span className="text-panel-text-secondary">Code:</span>
            <pre className="mt-1.5 p-2.5 bg-black/30 rounded-md text-emerald-400 text-xs whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
              {event.code}
            </pre>
          </div>
        );

      case 'code_result':
        return (
          <div className="space-y-2">
            {event.stdout && (
              <div>
                <span className="text-panel-text-secondary">Output:</span>
                <pre className="mt-1.5 p-2.5 bg-black/30 rounded-md text-panel-text text-xs whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
                  {event.stdout}
                </pre>
              </div>
            )}
            {event.stderr && (
              <div>
                <span className="text-red-400">Stderr:</span>
                <pre className="mt-1.5 p-2.5 bg-red-950/30 rounded-md text-red-300 text-xs whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto leading-relaxed">
                  {event.stderr}
                </pre>
              </div>
            )}
            {!event.stdout && !event.stderr && (
              <span className="text-panel-text-secondary italic">No output</span>
            )}
          </div>
        );

      case 'subcall_complete':
        return (
          <div className="space-y-2">
            <DetailRow label="Model" value={event.model} />
            <DetailRow label="Time" value={`${event.time_ms}ms`} />
            {'response' in event && typeof event.response === 'string' && event.response && (
              <div>
                <span className="text-panel-text-secondary">Response:</span>
                <pre className="mt-1.5 p-2.5 bg-black/30 rounded-md text-panel-text text-xs whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
                  {event.response}
                </pre>
              </div>
            )}
          </div>
        );

      case 'usage_summary':
        return (
          <div className="space-y-1.5">
            <DetailRow label="Input tokens" value={event.input_tokens.toLocaleString()} />
            <DetailRow label="Output tokens" value={event.output_tokens.toLocaleString()} />
            {event.execution_time_ms != null && (
              <DetailRow label="Execution time" value={`${(event.execution_time_ms / 1000).toFixed(2)}s`} />
            )}
            {'models_used' in event && (
              <DetailRow label="Models used" value={(event.models_used as string[]).join(', ')} />
            )}
          </div>
        );

      case 'error':
        return (
          <div className="space-y-2">
            <DetailRow label="Message" value={event.message} />
            {'code' in event && <DetailRow label="Code" value={event.code} />}
            {'traceback' in event && event.traceback && (
              <div>
                <span className="text-panel-text-secondary">Traceback:</span>
                <pre className="mt-1.5 p-2.5 bg-red-950/30 rounded-md text-red-300 text-xs whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
                  {event.traceback}
                </pre>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel-bg text-panel-text">
      {/* Header with Status */}
      <div className="px-4 py-3 border-b border-panel-border bg-panel-surface">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-panel-text">RLM Progress</h3>

          {/* Status Indicator */}
          {status === 'live' && (
            <span className="flex items-center gap-2 text-xs text-green-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-gentle-pulse"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
              </span>
              Live
            </span>
          )}
          {status === 'complete' && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Complete
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
              </svg>
              Error
            </span>
          )}
        </div>

        {/* Indeterminate Progress Bar (while processing) */}
        {isStreaming && !hasFinalAnswer && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-panel-text-secondary mb-1.5">
              <span>
                {currentIteration > 0
                  ? `Iteration ${currentIteration}`
                  : 'Starting...'}
              </span>
            </div>
            <div className="h-1 bg-panel-border rounded-full overflow-hidden">
              <div className="h-full w-1/4 bg-blue-500/80 rounded-full animate-indeterminate" />
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {finalAnswerEvent && (
          <div className="mt-2 text-xs text-panel-text-secondary">
            <span>
              Completed in {finalAnswerEvent.total_iterations} iteration{finalAnswerEvent.total_iterations !== 1 ? 's' : ''} ({(finalAnswerEvent.total_time_ms / 1000).toFixed(1)}s)
            </span>
          </div>
        )}
      </div>

      {/* Event Timeline */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 dark-scrollbar relative"
      >
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-panel-text-secondary">No events yet</p>
              <p className="text-xs text-panel-text-secondary/60 mt-1">Submit a message to see progress</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayEvents.map((event, index) => {
              const isExpandable = hasDetails(event);
              const isExpanded = expandedEvents.has(index);
              const animationClass = getAnimationClass(index);

              return (
                <div
                  key={index}
                  className={`rounded-lg text-xs transition-all duration-200 ${
                    event.type === 'error'
                      ? 'bg-red-950/50 ring-1 ring-red-500/20'
                      : event.type === 'final_answer'
                      ? 'bg-green-950/50 ring-1 ring-green-500/20'
                      : 'bg-panel-surface hover:bg-panel-surface-hover'
                  } ${isExpandable ? 'cursor-pointer' : ''} ${animationClass}`}
                >
                  {/* Collapsed Header - Always visible */}
                  <div
                    className="p-2.5 flex items-start gap-2.5"
                    onClick={() => isExpandable && toggleEvent(index)}
                  >
                    <span className="flex-shrink-0 mt-0.5">{getEventIcon(event.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-panel-text break-words leading-relaxed">
                        {getEventSummary(event)}
                      </p>
                      <p className="text-panel-text-secondary/60 mt-1 text-[11px]">
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                    {/* Expand/collapse chevron */}
                    {isExpandable && (
                      <span className="flex-shrink-0 text-panel-text-secondary mt-0.5">
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && isExpandable && (
                    <div className="px-2.5 pb-2.5 pt-0 border-t border-panel-border mt-0">
                      <div className="pt-2.5 text-xs">
                        {renderDetails(event)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={eventsEndRef} />
          </div>
        )}

        {/* Jump to latest button */}
        {showJumpButton && (
          <button
            onClick={() => scrollToBottom()}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5
                       bg-panel-surface/95 backdrop-blur-sm rounded-full shadow-lg
                       border border-panel-border text-xs text-panel-text-secondary
                       hover:text-panel-text hover:bg-panel-surface-hover transition-all duration-200"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Latest
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 border-t border-red-500/20 bg-red-950/50">
          <p className="text-xs text-red-300">
            <span className="font-medium">Error:</span> {error}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper component for detail rows
function DetailRow({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-panel-text-secondary flex-shrink-0">{label}:</span>
      <span className={`text-panel-text break-all ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
