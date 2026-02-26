/**
 * TitleBar Component
 *
 * Native-looking macOS title bar with:
 * - Space for traffic lights (window controls)
 * - App title
 * - Draggable region
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface TitleBarProps {
  title?: string;
  className?: string;
}

export function TitleBar({ title = 'Meeting Copilot', className }: TitleBarProps) {
  return (
    <div
      className={cn(
        'h-12 flex items-center justify-center border-b bg-background/80 backdrop-blur-lg shrink-0',
        'drag-region select-none',
        className
      )}
    >
      {/* Space for traffic lights - about 80px on macOS */}
      <div className="absolute left-0 w-20 h-full" />

      {/* App title */}
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
    </div>
  );
}

export default TitleBar;
