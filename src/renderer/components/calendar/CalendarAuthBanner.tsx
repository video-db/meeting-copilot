/**
 * Calendar Auth Banner Component
 *
 * Shows a banner when Google Calendar authentication is required.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { AlertCircle, X, RefreshCw, Loader2 } from 'lucide-react';

export function CalendarAuthBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Listen for auth required events
    const unsubscribe = window.electronAPI.calendarOn.onAuthRequired(() => {
      setIsVisible(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const result = await window.electronAPI.calendar.signIn();
      if (result.success) {
        setIsVisible(false);
      }
    } catch (err) {
      // Keep banner visible on error
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Google Calendar disconnected. Reconnect to continue receiving meeting notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            {isReconnecting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Reconnect
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-7 w-7 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CalendarAuthBanner;
