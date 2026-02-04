'use client';

import { useRef, useState } from 'react';

interface LandingPageProps {
  onUpload: (files: FileList) => void;
  hasDocuments: boolean;
  selectedDocCount: number;
  onStartSession: () => void;
}

export function LandingPage({
  onUpload,
  hasDocuments,
  selectedDocCount,
  onStartSession,
}: LandingPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-primary">
      <div className="max-w-2xl w-full text-center">
        {/* Hero Text */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-text-primary mb-3">
            <span className="text-accent-primary">AI-powered</span> document analysis
          </h1>
          <p className="text-lg text-text-secondary">
            Upload documents and ask questions using advanced reasoning
          </p>
        </div>

        {/* Feature Tabs (simplified - just showing Chat is active) */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-surface-secondary rounded-full p-1">
            <button className="px-4 py-2 rounded-full bg-accent-primary text-white text-sm font-medium">
              Chat
            </button>
            <button className="px-4 py-2 rounded-full text-text-secondary text-sm font-medium hover:text-text-primary transition-colors">
              Summary
            </button>
          </div>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-12 transition-all duration-200
              ${isDragging
                ? 'border-accent-primary bg-accent-subtle'
                : 'border-border hover:border-accent-muted hover:bg-surface-secondary'
              }
            `}
          >
            {/* Decorative arrow */}
            <div className="absolute -left-16 top-4 hidden lg:block">
              <svg className="w-24 h-16 text-accent-muted" viewBox="0 0 100 60" fill="none">
                <path
                  d="M5 55 Q 30 55, 50 35 T 95 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                <path
                  d="M85 5 L95 10 L88 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              <span className="text-xs text-accent-muted font-medium -mt-2 block">
                DROP YOUR<br />FILE HERE
              </span>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-subtle flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-text-primary mb-2">
                  Drop a file or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-accent-primary hover:text-accent-primary-hover font-medium underline underline-offset-2"
                  >
                    upload
                  </button>
                </p>
                <p className="text-sm text-text-tertiary">
                  Supports PDF, TXT, MD, and DOCX
                </p>
              </div>
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
        </div>

        {/* Quick Start */}
        {hasDocuments && (
          <div className="bg-surface-secondary rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">
                  {selectedDocCount > 0
                    ? `${selectedDocCount} document${selectedDocCount > 1 ? 's' : ''} selected`
                    : 'Select documents to start'}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  Choose documents from the sidebar
                </p>
              </div>
              <button
                onClick={onStartSession}
                disabled={selectedDocCount === 0}
                className="px-6 py-2.5 bg-accent-primary hover:bg-accent-primary-hover disabled:bg-surface-tertiary disabled:text-text-tertiary text-white font-medium rounded-full transition-colors"
              >
                Start Chat
              </button>
            </div>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-text-tertiary">
          <kbd className="px-2 py-1 bg-surface-secondary rounded border border-border text-xs">
            Cmd
          </kbd>
          <span>+</span>
          <kbd className="px-2 py-1 bg-surface-secondary rounded border border-border text-xs">
            V
          </kbd>
          <span>to paste text or links</span>
        </div>
      </div>
    </div>
  );
}
