/**
 * Calendar Panel Component
 *
 * Settings panel for connecting/disconnecting Google Calendar.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  Loader2,
  LogOut,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { UpcomingMeeting } from '../../../shared/types/calendar.types';

type CalendarStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Status Badge Component
function StatusBadge({ status }: { status: CalendarStatus }) {
  switch (status) {
    case 'connected':
      return (
        <div className="flex items-center gap-[6px] px-[10px] py-[4px] bg-[#ecfdf5] border border-[#a7f3d0] rounded-[8px]">
          <Check className="h-[14px] w-[14px] text-[#059669]" />
          <span className="text-[13px] font-medium text-[#059669]">Connected</span>
        </div>
      );
    case 'connecting':
      return (
        <div className="flex items-center gap-[6px] px-[10px] py-[4px] bg-[#fff5ec] border border-[#fed7aa] rounded-[8px] animate-pulse">
          <Loader2 className="h-[14px] w-[14px] text-[#ec5b16] animate-spin" />
          <span className="text-[13px] font-medium text-[#ec5b16]">Connecting...</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-[6px] px-[10px] py-[4px] bg-[#fef2f2] border border-[#fecaca] rounded-[8px]">
          <AlertCircle className="h-[14px] w-[14px] text-[#dc2626]" />
          <span className="text-[13px] font-medium text-[#dc2626]">Error</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-[6px] px-[10px] py-[4px] bg-[#f7f7f7] border border-[#ededf3] rounded-[8px]">
          <span className="text-[13px] font-medium text-[#969696]">Not Connected</span>
        </div>
      );
  }
}

export function CalendarPanel() {
  const [status, setStatus] = useState<CalendarStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingMeeting[]>([]);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();

    // Listen for events updates
    const unsubscribe = window.electronAPI.calendarOn.onEventsUpdated((events) => {
      setUpcomingEvents(events);
    });

    // Listen for auth required
    const unsubAuthRequired = window.electronAPI.calendarOn.onAuthRequired(() => {
      setStatus('error');
      setError('Calendar session expired. Please reconnect.');
    });

    return () => {
      unsubscribe();
      unsubAuthRequired();
    };
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.calendar.isSignedIn();
      if (result.success && result.isSignedIn) {
        setStatus('connected');
        // Fetch initial events
        const eventsResult = await window.electronAPI.calendar.getUpcomingEvents(24);
        if (eventsResult.success && eventsResult.events) {
          setUpcomingEvents(eventsResult.events);
        }
      } else {
        setStatus('disconnected');
      }
      setError(null);
    } catch (err) {
      setStatus('error');
      setError('Failed to check calendar status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setStatus('connecting');
    setError(null);
    try {
      const result = await window.electronAPI.calendar.signIn();
      if (result.success) {
        setStatus('connected');
        // Fetch events after connecting
        const eventsResult = await window.electronAPI.calendar.getUpcomingEvents(24);
        if (eventsResult.success && eventsResult.events) {
          setUpcomingEvents(eventsResult.events);
        }
      } else {
        setStatus('error');
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      setStatus('error');
      setError('Connection failed');
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.calendar.signOut();
      setStatus('disconnected');
      setUpcomingEvents([]);
      setError(null);
    } catch (err) {
      setError('Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  };

  const formatEventTime = (event: UpcomingMeeting) => {
    if (event.isAllDay) return 'All day';
    return event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-[16px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[#141420] flex items-center gap-[8px]">
            <Calendar className="h-[18px] w-[18px]" />
            Google Calendar
          </h2>
          <p className="text-[13px] text-[#969696] mt-[2px]">
            Get notified before your meetings start
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <StatusBadge status={status} />
          {status === 'connected' && (
            <button
              onClick={checkAuthStatus}
              disabled={isLoading}
              className="w-[32px] h-[32px] flex items-center justify-center border border-[#ededf3] rounded-[8px] bg-white hover:bg-[#f7f7f7] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-[14px] w-[14px] text-[#464646] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Connection Card */}
      <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
        <div className="px-[20px] py-[16px] border-b border-[#ededf3]">
          <h3 className="text-[15px] font-semibold text-[#141420]">Calendar Connection</h3>
          <p className="text-[13px] text-[#969696] mt-[4px]">
            Connect your Google Calendar to receive notifications 2 minutes before meetings start.
          </p>
        </div>
        <div className="px-[20px] py-[20px]">
          {error && (
            <div className="p-[12px] bg-[#fef2f2] border border-[#fecaca] rounded-[10px] mb-[16px]">
              <p className="text-[13px] text-[#dc2626] flex items-center gap-[8px]">
                <AlertCircle className="h-[14px] w-[14px]" />
                {error}
              </p>
            </div>
          )}

          {status === 'disconnected' && (
            <div className="flex flex-col items-center py-[32px]">
              <div className="w-[48px] h-[48px] flex items-center justify-center bg-[#f7f7f7] rounded-[12px] mb-[16px]">
                <Calendar className="h-[24px] w-[24px] text-[#969696]" />
              </div>
              <p className="text-[14px] text-[#464646] text-center mb-[16px]">
                Connect your Google Calendar to get started
              </p>
              <button
                onClick={handleConnect}
                className="flex items-center gap-[8px] px-[16px] py-[10px] bg-[#ec5b16] hover:bg-[#d9520f] text-white text-[14px] font-medium rounded-[10px] transition-colors"
              >
                <Calendar className="h-[16px] w-[16px]" />
                Connect Google Calendar
              </button>
            </div>
          )}

          {status === 'connecting' && (
            <div className="flex flex-col items-center py-[32px]">
              <Loader2 className="h-[48px] w-[48px] text-[#ec5b16] mb-[16px] animate-spin" />
              <p className="text-[14px] text-[#464646] text-center">
                Connecting to Google Calendar...
              </p>
              <p className="text-[12px] text-[#969696] text-center mt-[8px]">
                A browser window will open for authorization
              </p>
            </div>
          )}

          {status === 'connected' && (
            <div className="space-y-[16px]">
              <div className="flex items-center justify-between p-[12px] bg-[#ecfdf5] rounded-[10px]">
                <div className="flex items-center gap-[8px]">
                  <Check className="h-[18px] w-[18px] text-[#059669]" />
                  <span className="text-[14px] font-medium text-[#059669]">
                    Calendar connected
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="flex items-center gap-[6px] px-[12px] py-[6px] border border-[#ededf3] rounded-[8px] bg-white hover:bg-[#f7f7f7] text-[13px] font-medium text-[#464646] transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-[14px] w-[14px]" />
                  Disconnect
                </button>
              </div>

              {/* Upcoming Events Preview */}
              {upcomingEvents.length > 0 && (
                <div className="space-y-[8px]">
                  <h4 className="text-[14px] font-medium text-[#141420]">
                    Upcoming Meetings (next 24h)
                  </h4>
                  <div className="space-y-[8px] max-h-[192px] overflow-y-auto">
                    {upcomingEvents.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-[10px] bg-[#f7f7f7] rounded-[8px]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[#141420] truncate">{event.summary}</p>
                          <p className="text-[12px] text-[#969696]">
                            {formatEventTime(event)}
                            {event.minutesUntil > 0 && event.minutesUntil <= 60 && (
                              <span className="ml-[8px] text-[#ec5b16]">
                                in {event.minutesUntil}m
                              </span>
                            )}
                          </p>
                        </div>
                        {event.meetLink && (
                          <div className="px-[8px] py-[2px] bg-white border border-[#ededf3] rounded-[6px] ml-[8px]">
                            <span className="text-[11px] font-medium text-[#464646]">Meet</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {upcomingEvents.length > 5 && (
                    <p className="text-[12px] text-[#969696] text-center">
                      +{upcomingEvents.length - 5} more events
                    </p>
                  )}
                </div>
              )}

              {upcomingEvents.length === 0 && (
                <p className="text-[14px] text-[#969696] text-center py-[16px]">
                  No upcoming meetings in the next 24 hours
                </p>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center py-[32px]">
              <div className="w-[48px] h-[48px] flex items-center justify-center bg-[#fef2f2] rounded-[12px] mb-[16px]">
                <AlertCircle className="h-[24px] w-[24px] text-[#dc2626]" />
              </div>
              <p className="text-[14px] text-[#464646] text-center mb-[16px]">
                {error || 'Something went wrong'}
              </p>
              <button
                onClick={handleConnect}
                className="flex items-center gap-[8px] px-[16px] py-[10px] bg-[#ec5b16] hover:bg-[#d9520f] text-white text-[14px] font-medium rounded-[10px] transition-colors"
              >
                <RefreshCw className="h-[16px] w-[16px]" />
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
        <div className="px-[20px] py-[16px]">
          <div className="space-y-[12px]">
            <div className="flex items-start gap-[12px]">
              <div className="w-[24px] h-[24px] rounded-full bg-[#fff5ec] flex items-center justify-center shrink-0">
                <span className="text-[12px] font-semibold text-[#ec5b16]">1</span>
              </div>
              <p className="text-[13px] text-[#464646] leading-[18px]">
                <span className="font-medium text-[#141420]">System Tray:</span> When you close the app, it continues running in your system tray to monitor your calendar.
              </p>
            </div>
            <div className="flex items-start gap-[12px]">
              <div className="w-[24px] h-[24px] rounded-full bg-[#fff5ec] flex items-center justify-center shrink-0">
                <span className="text-[12px] font-semibold text-[#ec5b16]">2</span>
              </div>
              <p className="text-[13px] text-[#464646] leading-[18px]">
                <span className="font-medium text-[#141420]">Notifications:</span> You'll receive a notification 2 minutes before each meeting starts.
              </p>
            </div>
            <div className="flex items-start gap-[12px]">
              <div className="w-[24px] h-[24px] rounded-full bg-[#fff5ec] flex items-center justify-center shrink-0">
                <span className="text-[12px] font-semibold text-[#ec5b16]">3</span>
              </div>
              <p className="text-[13px] text-[#464646] leading-[18px]">
                <span className="font-medium text-[#141420]">Privacy:</span> Your calendar data stays on your device. We only read event titles and times to send notifications.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarPanel;
