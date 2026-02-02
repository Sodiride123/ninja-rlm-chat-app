'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ChatMessage } from '@/lib/types';

// Component to render text with paragraph-by-paragraph reveal animation
function RevealText({ content, animate }: { content: string; animate: boolean }) {
  // Split content into paragraphs (double newline) or lines
  const paragraphs = useMemo(() => {
    // Split by double newlines first, then by single newlines for longer texts
    const parts = content.split(/\n\n+/);
    if (parts.length > 1) {
      return parts;
    }
    // If no double newlines, split by single newlines but group small chunks
    const lines = content.split(/\n/);
    if (lines.length <= 3) {
      return [content]; // Show short content as single block
    }
    return lines;
  }, [content]);

  if (!animate || paragraphs.length <= 1) {
    return <span>{content}</span>;
  }

  return (
    <>
      {paragraphs.map((para, idx) => (
        <span
          key={idx}
          className="reveal-paragraph block"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          {para}
          {idx < paragraphs.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  hasSession: boolean;
  isReadOnly?: boolean;
  selectedRunId: string | null;
  onSendMessage: (message: string) => void;
  onSelectMessage: (runId: string | null) => void;
}

export function ChatPanel({
  messages,
  isProcessing,
  hasSession,
  isReadOnly = false,
  selectedRunId,
  onSendMessage,
  onSelectMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track which messages have been "seen" to animate only new ones
  const [seenMessageCount, setSeenMessageCount] = useState(0);
  const prevMessagesLengthRef = useRef(messages.length);

  // Smart auto-scroll state
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  // Update seen count when messages change (but not for the newest assistant message)
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;

    if (currentLength > prevLength) {
      // New message(s) added - mark previous ones as seen
      // The newest assistant message will animate
      setSeenMessageCount(prevLength);
    } else if (currentLength < prevLength) {
      // Messages cleared (session change) - reset
      setSeenMessageCount(0);
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

  // Check if scrolled to bottom (with small threshold)
  const checkIfAtBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll events to track position
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    setShowJumpButton(!atBottom && (messages.length > 0 || isProcessing));
  }, [checkIfAtBottom, messages.length, isProcessing]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setIsAtBottom(true);
    setShowJumpButton(false);
  }, []);

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    } else {
      // Show jump button when new content arrives and user is scrolled up
      setShowJumpButton(true);
    }
  }, [messages, isProcessing, isAtBottom, scrollToBottom]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 200;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && hasSession && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      // Scroll to bottom on submit (optimistic)
      setIsAtBottom(true);
      setTimeout(() => scrollToBottom(false), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMessageClick = (message: ChatMessage) => {
    // Only assistant messages have run_id and are clickable
    if (message.role === 'assistant' && message.run_id) {
      // Toggle selection
      if (selectedRunId === message.run_id) {
        onSelectMessage(null);
      } else {
        onSelectMessage(message.run_id);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-primary relative">
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-5"
      >
        {!hasSession ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-text-tertiary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-secondary">Start a session to begin</p>
              <p className="text-sm text-text-tertiary mt-1">Select documents and click &quot;Start Session&quot;</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <p className="text-sm font-medium text-text-secondary">Ready to chat</p>
              <p className="text-sm text-text-tertiary mt-1">Ask a question about your documents</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isAssistant = message.role === 'assistant';
            const hasProgress = isAssistant && message.run_id;
            const isSelected = hasProgress && selectedRunId === message.run_id;
            const isNewMessage = index >= seenMessageCount;
            const shouldAnimate = isAssistant && isNewMessage && !isReadOnly;

            return (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${
                  shouldAnimate ? 'animate-message-reveal' : ''
                }`}
              >
                <div
                  onClick={() => handleMessageClick(message)}
                  className={`max-w-[65%] rounded-2xl px-4 py-3 transition-all duration-200 ${
                    message.role === 'user'
                      ? 'bg-surface-user mr-[10%]'
                      : isSelected
                      ? 'bg-accent-subtle ring-1 ring-accent-primary/30 ml-[10%]'
                      : 'ml-[10%]'
                  } ${hasProgress ? 'cursor-pointer hover:bg-accent-subtle/50' : ''}`}
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-text-primary">
                    {isAssistant ? (
                      <RevealText content={message.content} animate={shouldAnimate} />
                    ) : (
                      message.content
                    )}
                  </p>
                  {hasProgress && (
                    <div className="flex items-center justify-end mt-2">
                      <span
                        className={`text-xs flex items-center gap-1.5 transition-colors ${
                          isSelected ? 'text-accent-primary' : 'text-text-tertiary'
                        }`}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        {isSelected ? 'Viewing' : 'View progress'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary rounded-2xl px-4 py-3 ml-[10%]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-text-secondary">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Jump to latest button */}
      {showJumpButton && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom()}
            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary/95 backdrop-blur-sm
                       rounded-full shadow-lg border border-border/50
                       text-sm text-text-secondary hover:text-text-primary
                       hover:bg-surface-hover transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Jump to latest
          </button>
        </div>
      )}

      {/* Floating Composer Input */}
      <div className="p-4 pb-6 bg-gradient-to-t from-surface-primary via-surface-primary to-transparent">
        {isReadOnly ? (
          <div className="max-w-3xl mx-auto text-center py-3 px-4 bg-amber-50 rounded-2xl border border-amber-200">
            <p className="text-sm text-amber-700">
              Viewing ended session (read-only)
            </p>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="relative flex items-end gap-3 max-w-3xl mx-auto
                         bg-surface-secondary/80 backdrop-blur-sm
                         rounded-3xl border border-border/50
                         shadow-lg shadow-black/5
                         transition-all duration-200
                         focus-within:border-border focus-within:shadow-xl focus-within:shadow-black/10"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasSession
                    ? 'Ask a question about your documents...'
                    : 'Start a session first'
                }
                disabled={!hasSession || isProcessing}
                rows={1}
                className="flex-1 px-5 py-4 bg-transparent resize-none
                           text-text-primary text-[15px] leading-relaxed
                           focus:outline-none
                           disabled:cursor-not-allowed disabled:text-text-tertiary
                           placeholder:text-text-tertiary"
                style={{ minHeight: '52px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || !hasSession || isProcessing}
                className="flex-shrink-0 m-2 p-2.5 rounded-full
                           bg-accent-primary text-white
                           hover:bg-accent-primary-hover
                           disabled:bg-surface-tertiary disabled:text-text-tertiary disabled:cursor-not-allowed
                           transition-all duration-200"
                aria-label="Send message"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19V5m0 0l-7 7m7-7l7 7"
                  />
                </svg>
              </button>
            </form>
            <p className="text-center text-xs text-text-tertiary mt-3">
              Press Enter to send, Shift+Enter for new line
            </p>
          </>
        )}
      </div>
    </div>
  );
}
