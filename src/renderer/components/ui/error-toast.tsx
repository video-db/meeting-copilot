/**
 * Error Toast Component
 *
 * Shows error messages as a toast notification.
 * Auto-dismisses after a timeout or can be manually dismissed.
 */

import React, { useEffect, useState } from 'react';
import { Button } from './button';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
  className?: string;
  position?: 'top' | 'bottom';
  autoDismissMs?: number;
}

export function ErrorToast({
  message,
  onDismiss,
  className,
  position = 'bottom',
  autoDismissMs = 8000,
}: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (message) {
      setIsAnimating(true);
      setTimeout(() => setIsVisible(true), 10);

      // Auto-dismiss
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissMs);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [message, autoDismissMs]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsAnimating(false);
      onDismiss();
    }, 300);
  };

  if (!isAnimating || !message) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed z-50 left-1/2 -translate-x-1/2 transition-all duration-300 ease-out',
        position === 'top' ? 'top-4' : 'bottom-20',
        isVisible
          ? 'opacity-100 translate-y-0'
          : position === 'top'
          ? 'opacity-0 -translate-y-4'
          : 'opacity-0 translate-y-4',
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm max-w-md bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100">
        <div className="p-2 rounded-full bg-red-200 dark:bg-red-900">
          <AlertCircle className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Error</p>
          <p className="text-xs opacity-90 mt-0.5">{message}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-white/20"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default ErrorToast;
