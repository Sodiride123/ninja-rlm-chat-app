'use client';

interface HeaderProps {
  sessionTitle?: string | null;
  hasActiveSession: boolean;
  logoSrc?: string;
}

export function Header({
  sessionTitle,
  hasActiveSession,
  logoSrc,
}: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        {logoSrc ? (
          <img src={logoSrc} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
        <span className="font-semibold text-text-primary">Ninja RLM Chat</span>
      </div>

      {/* Center: Session title (if active) */}
      <div className="flex-1 flex justify-center">
        {hasActiveSession && sessionTitle && (
          <span className="text-sm text-text-secondary truncate max-w-md">
            {sessionTitle}
          </span>
        )}
      </div>

      {/* Right: Empty for now */}
      <div className="w-32" />
    </header>
  );
}
