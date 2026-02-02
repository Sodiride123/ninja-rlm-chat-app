'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction: 'left' | 'right';
}

export function ResizeHandle({ onResize, direction }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    lastX.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      // For right-side panels, invert the delta
      onResize(direction === 'right' ? -delta : delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Change cursor for entire document while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, onResize, direction]);

  return (
    <div
      className={`
        w-px flex-shrink-0 cursor-col-resize relative group
        ${isDragging ? 'bg-accent-primary' : 'bg-border-subtle hover:bg-border'}
        transition-colors duration-200
      `}
      onMouseDown={handleMouseDown}
    >
      {/* Invisible wider hit area */}
      <div className="absolute inset-y-0 -left-2 -right-2 z-10" />

      {/* Subtle visual indicator on hover */}
      <div
        className={`
          absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 rounded-full
          ${isDragging ? 'bg-accent-primary' : 'bg-transparent group-hover:bg-text-tertiary'}
          transition-all duration-200
        `}
      />
    </div>
  );
}
