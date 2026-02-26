/**
 * Nudge Toast Component
 *
 * Non-intrusive coaching suggestions that appear during calls.
 * Auto-dismisses after a timeout or can be manually dismissed.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import {
  X,
  MessageCircle,
  TrendingDown,
  BarChart3,
  Clock,
  HelpCircle,
  Gauge,
  Lightbulb,
} from 'lucide-react';
import { useCopilotStore } from '../../stores/copilot.store';
import { useCopilot } from '../../hooks/useCopilot';
import { cn } from '../../lib/utils';
import type { CopilotNudge } from '../../../shared/types/ipc.types';

// Sub-components

function getNudgeIcon(type: string) {
  switch (type) {
    case 'monologue':
      return <MessageCircle className="h-4 w-4" />;
    case 'sentiment':
      return <TrendingDown className="h-4 w-4" />;
    case 'talk_ratio':
      return <BarChart3 className="h-4 w-4" />;
    case 'next_steps':
      return <Clock className="h-4 w-4" />;
    case 'questions':
      return <HelpCircle className="h-4 w-4" />;
    case 'pace':
      return <Gauge className="h-4 w-4" />;
    default:
      return <Lightbulb className="h-4 w-4" />;
  }
}

function getSeverityStyles(severity: string) {
  switch (severity) {
    case 'high':
      return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100';
    case 'medium':
      return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100';
    default:
      return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100';
  }
}

// Main Component

interface NudgeToastProps {
  className?: string;
  position?: 'top' | 'bottom';
  autoDismissMs?: number;
}

export function NudgeToast({
  className,
  position = 'bottom',
  autoDismissMs = 10000,
}: NudgeToastProps) {
  const { activeNudge, isCallActive } = useCopilotStore();
  const { dismissNudge } = useCopilot();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (activeNudge && isCallActive) {
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
  }, [activeNudge, isCallActive, autoDismissMs]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsAnimating(false);
      dismissNudge();
    }, 300);
  };

  if (!isAnimating || !activeNudge) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-50 left-1/2 -translate-x-1/2 transition-all duration-300 ease-out",
        position === 'top' ? "top-4" : "bottom-4",
        isVisible
          ? "opacity-100 translate-y-0"
          : position === 'top'
            ? "opacity-0 -translate-y-4"
            : "opacity-0 translate-y-4",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm max-w-md",
          getSeverityStyles(activeNudge.severity)
        )}
      >
        <div className={cn(
          "p-2 rounded-full",
          activeNudge.severity === 'high'
            ? "bg-red-200 dark:bg-red-900"
            : activeNudge.severity === 'medium'
              ? "bg-amber-200 dark:bg-amber-900"
              : "bg-blue-200 dark:bg-blue-900"
        )}>
          {getNudgeIcon(activeNudge.type)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{activeNudge.message}</p>
          {activeNudge.actionLabel && (
            <p className="text-xs opacity-75 mt-0.5">{activeNudge.actionLabel}</p>
          )}
        </div>

        {activeNudge.dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 hover:bg-white/20"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default NudgeToast;
