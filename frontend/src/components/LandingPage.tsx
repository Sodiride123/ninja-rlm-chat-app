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

  // Resource card data
  const resources = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
      label: 'Blog',
      title: 'Introducing RLM',
      description: 'Learn about Recursive Language Models and how they enable ultra-long context understanding for document analysis.',
      image: '/rlm-blog-cover.png',
      link: 'https://alexzhang13.github.io/blog/2025/rlm/',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      label: 'Paper',
      title: 'Research Paper on arXiv',
      description: 'Dive into the technical details of recursive reasoning and ultra-long context processing in the original research paper.',
      image: '/rlm-paper-cover.png',
      link: 'https://arxiv.org/abs/2502.11909',
    },
    {
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
      label: 'GitHub',
      title: 'Open Source Repository',
      description: 'Explore the open-source RLM inference framework. Star, fork, and contribute to the project.',
      image: '/rlm-github-cover.png',
      link: 'https://github.com/alexzhang13/rlm',
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto p-8 bg-surface-primary">
      {/* Main Upload Section */}
      <div className="max-w-2xl w-full text-center pt-8">
        {/* Hero Text */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-text-primary">
            <span className="text-accent-primary">Best Ninja AI tool</span> for analyzing your Ultra-Long documents
          </h1>
        </div>

        {/* Upload Area with gradient glow */}
        <div className="mb-8 relative">
          {/* Gradient glow background - soft purple halo */}
          <div
            className="absolute -inset-8 rounded-[32px] opacity-60 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(167, 139, 250, 0.3) 0%, rgba(196, 181, 253, 0.2) 40%, rgba(245, 243, 255, 0.1) 70%, transparent 100%)',
            }}
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-12 transition-all duration-200
              ${isDragging
                ? 'border-accent-primary bg-accent-subtle'
                : 'border-purple-200 bg-purple-50/30 hover:border-accent-muted hover:bg-purple-50/50'
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

      {/* Introduction Section - ChatPDF style */}
      <div className="w-full max-w-5xl mt-20 mb-12 px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-text-primary mb-4">
            Introduction of <span className="text-accent-primary">Ninja Documents</span>
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Powered by RLM (Recursive Language Model), which can help you analyse as many documents as you want
          </p>
        </div>

        {/* Resource Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {resources.map((resource, index) => (
            <a
              key={index}
              href={resource.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                group bg-white rounded-2xl p-6
                shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.06)]
                hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.1)]
                hover:-translate-y-1
                transition-all duration-300 ease-out
                border border-gray-100/80
                ${index === 2 ? 'md:col-span-2 md:max-w-[calc(50%-12px)] md:mx-auto' : ''}
              `}
            >
              {/* Card Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-accent-primary">
                  {resource.icon}
                </div>
                <span className="text-xs font-medium text-accent-primary bg-purple-50 px-2 py-0.5 rounded-full">
                  {resource.label}
                </span>
              </div>

              {/* Card Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-accent-primary transition-colors">
                {resource.title}
              </h3>

              {/* Card Description */}
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {resource.description}
              </p>

              {/* Card Image */}
              <div className="relative overflow-hidden rounded-xl bg-gray-50 border border-gray-100">
                <img
                  src={resource.image}
                  alt={resource.title}
                  className="w-full h-40 object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
