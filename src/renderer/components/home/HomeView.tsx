/**
 * HomeView Component
 *
 * New home page design with:
 * - App permissions section with toggles
 * - Start Recording button
 * - Recent meetings
 * - Today's calendar events
 * - Connected MCP servers
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { trpc } from '../../api/trpc';
import { useMCP } from '../../hooks/useMCP';
import { useSessionStore } from '../../stores/session.store';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { RecordingCard } from '../history/RecordingCard';
import { RecordingDetailPage } from '../history/RecordingDetailPage';
import type { UpcomingMeeting } from '../../../shared/types/calendar.types';
import type { MCPServerConfig } from '../../../preload/index';

// Hook for auto-hiding scrollbar
function useAutoHideScrollbar(timeout = 1500) {
  const [isScrolling, setIsScrolling] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, timeout);
  }, [timeout]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isScrolling, handleScroll };
}

// Scrollbar styles
const scrollbarBaseStyles = `
  [&::-webkit-scrollbar]:w-[6px]
  [&::-webkit-scrollbar-track]:bg-transparent
  [&::-webkit-scrollbar-thumb]:rounded-full
  [&::-webkit-scrollbar-thumb]:transition-colors
  [&::-webkit-scrollbar-thumb]:duration-300
`;
const scrollbarVisibleStyles = '[&::-webkit-scrollbar-thumb]:bg-[#c1c1c1]';
const scrollbarHiddenStyles = '[&::-webkit-scrollbar-thumb]:bg-transparent';

// Icons
function SpeakerIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 3.333L5.833 6.667H2.5v6.666h3.333L10 16.667V3.333z"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={enabled ? 'rgba(236,91,22,0.2)' : 'none'}
      />
      <path
        d="M14.167 7.5a4.167 4.167 0 010 5M16.667 5a7.5 7.5 0 010 10"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="7.5"
        y="2.5"
        width="5"
        height="10"
        rx="2.5"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        fill={enabled ? 'rgba(236,91,22,0.2)' : 'none'}
      />
      <path
        d="M15 8.333v1.667a5 5 0 01-10 0V8.333M10 15v2.5M7.5 17.5h5"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScreenIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2.5"
        y="3.333"
        width="15"
        height="10"
        rx="1.5"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        fill={enabled ? 'rgba(236,91,22,0.2)' : 'none'}
      />
      <path
        d="M6.667 16.667h6.666"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 13.333v3.334"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NotificationIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2.5C7.5 2.5 5.5 4.5 5.5 7v3.5l-1.25 1.25c-.417.417-.125 1.125.458 1.125h10.584c.583 0 .875-.708.458-1.125L14.5 10.5V7c0-2.5-2-4.5-4.5-4.5z"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={enabled ? 'rgba(236,91,22,0.2)' : 'none'}
      />
      <path
        d="M8.5 15.833a1.667 1.667 0 003.333 0"
        stroke={enabled ? '#ec5b16' : '#464646'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="4.167" width="15" height="13.333" rx="2" stroke="black" strokeWidth="1.5" />
      <path d="M2.5 8.333h15" stroke="black" strokeWidth="1.5" />
      <path d="M6.667 2.5v3.333M13.333 2.5v3.333" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="#969696" strokeWidth="1.25" />
      <path d="M8 4.5v4l2.5 1.5" stroke="#969696" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MCPIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="3" stroke="black" strokeWidth="1.25" />
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="black" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M3.76 3.76l1.41 1.41M10.83 10.83l1.41 1.41M3.76 12.24l1.41-1.41M10.83 5.17l1.41-1.41" stroke="black" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function RecordingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="4" fill="white" />
      <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function EmptyRecordingsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="24" height="20" rx="2" stroke="#969696" strokeWidth="1.5" />
      <path d="M4 12h24" stroke="#969696" strokeWidth="1.5" />
      <rect x="8" y="16" width="6" height="6" rx="1" stroke="#969696" strokeWidth="1.5" />
      <path d="M18 17h6M18 21h4" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyCalendarIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6.5" width="24" height="21" rx="2" stroke="#969696" strokeWidth="1.5" />
      <path d="M4 12.5h24" stroke="#969696" strokeWidth="1.5" />
      <path d="M10 3.5v5M22 3.5v5" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyMCPIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="5" stroke="#969696" strokeWidth="1.5" />
      <path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 7.5l2.83 2.83M21.67 21.67l2.83 2.83M7.5 24.5l2.83-2.83M21.67 10.33l2.83-2.83" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7h4v6H3V7zM13 7h4v6h-4V7z" stroke="black" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10h2M11 10h2" stroke="black" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.5" stroke="black" strokeWidth="1.25" />
    </svg>
  );
}

function EmptyWorkflowIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 11h6v10H5V11zM21 11h6v10h-6V11z" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 16h3M18 16h3" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" stroke="#969696" strokeWidth="1.5" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.68 8.182c0-.567-.05-1.113-.145-1.636H8v3.094h4.305a3.68 3.68 0 01-1.597 2.415v2.007h2.585c1.513-1.393 2.387-3.444 2.387-5.88z" fill="#4285F4" />
      <path d="M8 16c2.16 0 3.97-.716 5.293-1.938l-2.585-2.007c-.716.48-1.632.763-2.708.763-2.083 0-3.848-1.407-4.479-3.297H.855v2.073A7.997 7.997 0 008 16z" fill="#34A853" />
      <path d="M3.521 9.521A4.813 4.813 0 013.27 8c0-.528.091-1.04.252-1.521V4.406H.855A7.997 7.997 0 000 8c0 1.29.309 2.512.855 3.594l2.666-2.073z" fill="#FBBC05" />
      <path d="M8 3.182c1.174 0 2.229.404 3.058.1197l2.292-2.292C11.967.794 10.157 0 8 0 4.872 0 2.167 1.793.855 4.406l2.666 2.073C4.152 4.589 5.917 3.182 8 3.182z" fill="#EA4335" />
    </svg>
  );
}

// Confirmation Dialog Component
function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'danger',
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-[16px] p-[24px] w-[400px] shadow-[0px_4px_24px_0px_rgba(0,0,0,0.15)] flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[8px]">
          <h3 className="text-[18px] font-semibold text-[#141420]">{title}</h3>
          <p className="text-[14px] text-[#464646] leading-[20px]">{message}</p>
        </div>
        <div className="flex gap-[12px] justify-end">
          <button
            onClick={onCancel}
            className="px-[16px] py-[10px] rounded-[10px] border border-[#e4e4ec] text-[14px] font-medium text-[#464646] hover:bg-[#f7f7f7] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-[16px] py-[10px] rounded-[10px] text-[14px] font-medium text-white transition-colors ${
              variant === 'danger'
                ? 'bg-[#dc2626] hover:bg-[#b91c1c]'
                : 'bg-[#ec5b16] hover:bg-[#d4510f]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Component
function Toggle({
  enabled,
  onChange,
  size = 'default',
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'default' | 'small';
}) {
  const width = size === 'small' ? 'w-[32px]' : 'w-[38px]';
  const height = size === 'small' ? 'h-[18px]' : 'h-[22px]';
  const knobSize = size === 'small' ? 'size-[14px]' : 'size-[18px]';
  const knobOffset = size === 'small' ? (enabled ? 'left-[16px]' : 'left-[2px]') : (enabled ? 'left-[18px]' : 'left-[2px]');

  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`${width} ${height} rounded-full relative transition-colors ${
        enabled ? 'bg-[#ec5b16]' : 'bg-[#e4e4ec]'
      }`}
    >
      <div
        className={`absolute ${knobSize} bg-white rounded-full top-[2px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.15)] transition-all ${knobOffset}`}
      />
    </button>
  );
}

// Permission Item Component
function PermissionItem({
  icon,
  title,
  description,
  enabled,
  onChange,
  isFirst,
  isLast,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const bgColor = 'bg-white';
  const borderRadius = isFirst
    ? 'rounded-t-[10px]'
    : isLast
    ? 'rounded-b-[10px]'
    : '';

  return (
    <div className={`flex items-center gap-[14px] px-[16px] py-[13px] ${bgColor} ${borderRadius}`}>
      <div
        className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center ${
          enabled
            ? 'bg-[rgba(236,91,22,0.1)] border border-[rgba(236,91,22,0.13)]'
            : 'bg-white border border-[#ededf3]'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-medium text-[#141420] leading-[20px]">{title}</p>
        <p className="text-[13px] text-[rgba(70,70,70,0.6)] leading-[18px]">{description}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

// Calendar Event Item Component
function CalendarEventItem({
  event,
  notifyEnabled,
  onToggleNotify,
}: {
  event: UpcomingMeeting;
  notifyEnabled: boolean;
  onToggleNotify: (enabled: boolean) => void;
}) {
  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  };

  return (
    <div className="bg-white border border-[#ededf3] rounded-[10px] px-[15px] py-[13px]">
      <div className="flex items-start">
        <div className="flex-1 flex flex-col gap-[10px]">
          <p className="text-[14px] font-medium text-black tracking-[0.07px] line-clamp-1">
            {event.summary}
          </p>
          <div className="flex items-center gap-[12px]">
            <div className="flex items-center gap-[4px] flex-1">
              <ClockIcon />
              <span className="text-[14px] text-[#464646] tracking-[0.07px]">
                {formatTime(event.startTime)} - {formatTime(event.endTime)}
              </span>
            </div>
            <Toggle enabled={notifyEnabled} onChange={onToggleNotify} size="small" />
          </div>
        </div>
      </div>
    </div>
  );
}

// MCP Server Item Component
function MCPServerItem({
  server,
  onRemove,
}: {
  server: MCPServerConfig;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white border border-[#ededf3] rounded-[10px] px-[15px] py-[13px]">
      <div className="flex items-center gap-[12px]">
        <div className="w-[20px] h-[20px] flex items-center justify-center">
          <MCPIcon />
        </div>
        <div className="flex-1 flex flex-col gap-[6px]">
          <p className="text-[14px] font-medium text-black tracking-[0.07px]">{server.name}</p>
          <p className="text-[13px] text-[#464646] tracking-[0.065px]">
            {server.description || 'Sync meeting notes & summaries'}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#f7f7f7] rounded-[6px] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4l8 8M12 4l-8 8" stroke="#969696" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Workflow Item Component
function WorkflowItem({
  workflow,
  onEdit,
}: {
  workflow: { id: string; name: string; enabled: boolean };
  onEdit: () => void;
}) {
  return (
    <div className="bg-white border border-[#ededf3] rounded-[10px] px-[15px] py-[13px]">
      <div className="flex items-center gap-[6px]">
        <p className="flex-1 text-[14px] font-medium text-black tracking-[0.07px]">{workflow.name}</p>
        <button
          onClick={onEdit}
          className="w-[20px] h-[20px] flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.167 2.5L17.5 5.833M2.5 17.5L3.333 14.167L14.167 3.333L16.667 5.833L5.833 16.667L2.5 17.5Z" stroke="#969696" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface HomeViewProps {
  onStartRecording: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: (tab?: 'account' | 'notifications' | 'mcpServers' | 'workflows') => void;
}

interface WorkflowData {
  id: string;
  name: string;
  webhookUrl: string;
  enabled: boolean;
}

export function HomeView({ onStartRecording, onNavigateToHistory, onNavigateToSettings }: HomeViewProps) {
  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<'disconnected' | 'connected' | 'loading'>('loading');
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingMeeting[]>([]);
  const [eventNotifications, setEventNotifications] = useState<Record<string, boolean>>({});
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const { enabled: notificationsEnabled, openSettings: openNotificationSettings } =
    useNotificationPermission();

  // Auto-hide scrollbars
  const leftScrollbar = useAutoHideScrollbar();
  const rightScrollbar = useAutoHideScrollbar();

  // Session state for stream toggles
  const sessionStore = useSessionStore();
  const { streams, setStreams } = sessionStore;

  const { servers, connectionStates } = useMCP();
  const connectedServers = servers.filter(
    (s) => s.isEnabled && connectionStates[s.id]?.status === 'connected'
  );

  // Fetch recordings
  const { data: recordings, isLoading: recordingsLoading } = trpc.recordings.list.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Get recent recordings (latest 2)
  const recentRecordings = useMemo(() => {
    if (!recordings) return [];
    return [...recordings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2);
  }, [recordings]);

  // Check calendar status
  useEffect(() => {
    const checkCalendar = async () => {
      try {
        const result = await window.electronAPI.calendar.isSignedIn();
        if (result.success && result.isSignedIn) {
          setCalendarStatus('connected');
          // Fetch today's events
          const eventsResult = await window.electronAPI.calendar.getUpcomingEvents(24);
          if (eventsResult.success && eventsResult.events) {
            // Filter to only today's events
            const today = new Date();
            const todayEvents = eventsResult.events.filter((e) => {
              const eventDate = new Date(e.startTime);
              return (
                eventDate.getDate() === today.getDate() &&
                eventDate.getMonth() === today.getMonth() &&
                eventDate.getFullYear() === today.getFullYear()
              );
            });
            setUpcomingEvents(todayEvents);
            // Initialize notifications as enabled for all events
            const notifs: Record<string, boolean> = {};
            todayEvents.forEach((e) => {
              notifs[e.id] = true;
            });
            setEventNotifications(notifs);
          }
        } else {
          setCalendarStatus('disconnected');
        }
      } catch {
        setCalendarStatus('disconnected');
      }
    };
    checkCalendar();

    // Listen for event updates
    const unsubscribe = window.electronAPI.calendarOn.onEventsUpdated((events) => {
      const today = new Date();
      const todayEvents = events.filter((e) => {
        const eventDate = new Date(e.startTime);
        return (
          eventDate.getDate() === today.getDate() &&
          eventDate.getMonth() === today.getMonth() &&
          eventDate.getFullYear() === today.getFullYear()
        );
      });
      setUpcomingEvents(todayEvents);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleNotifications = async () => {
    await openNotificationSettings();
  };

  // Load workflows
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const result = await window.electronAPI.workflows.getAll();
        if (result.success && result.workflows) {
          setWorkflows(result.workflows);
        }
      } catch {
        // Ignore errors
      }
    };
    loadWorkflows();
  }, []);

  const handleConnectCalendar = async () => {
    try {
      const result = await window.electronAPI.calendar.signIn();
      if (result.success) {
        setCalendarStatus('connected');
        const eventsResult = await window.electronAPI.calendar.getUpcomingEvents(24);
        if (eventsResult.success && eventsResult.events) {
          setUpcomingEvents(eventsResult.events);
        }
      }
    } catch {
      // Ignore errors
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await window.electronAPI.calendar.signOut();
      setCalendarStatus('disconnected');
      setUpcomingEvents([]);
      setShowDisconnectConfirm(false);
    } catch {
      // Ignore errors
    }
  };

  // If viewing a recording detail
  if (selectedRecordingId !== null) {
    return (
      <RecordingDetailPage
        recordingId={selectedRecordingId}
        onBack={() => setSelectedRecordingId(null)}
      />
    );
  }

  return (
    <div className="flex gap-[24px] h-full p-[24px] bg-white overflow-hidden">
      {/* Left Column */}
      <div
        className={`flex-1 flex flex-col gap-[40px] overflow-y-auto ${scrollbarBaseStyles} ${leftScrollbar.isScrolling ? scrollbarVisibleStyles : scrollbarHiddenStyles}`}
        onScroll={leftScrollbar.handleScroll}
      >
        <div className="flex flex-col gap-[30px] w-full">
          {/* Dashboard Header with Start Recording button */}
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-black tracking-tight">
              Dashboard
            </h1>
            <button
              onClick={onStartRecording}
              disabled={!streams.systemAudio && !streams.microphone}
              className="flex items-center gap-[4px] bg-[#ff4000] hover:bg-[#e63900] disabled:opacity-50 disabled:cursor-not-allowed px-[20px] py-[12px] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] transition-colors"
            >
              <RecordingIcon />
              <span className="text-[14px] font-semibold text-white tracking-[-0.28px]">
                Start Recording
              </span>
            </button>
          </div>

          {/* App Permissions Section */}
          <div className="bg-[#f7f7f7] border border-[#efefef] rounded-[12px] p-[16px] flex flex-col gap-[20px]">
            <h2 className="text-[18px] font-semibold text-[#141420] tracking-[-0.17px] leading-[25.5px]">
              App permissions
            </h2>

            {/* Permission Toggles */}
            <div className="flex flex-col rounded-[12px] overflow-hidden border border-[#efefef]">
              <PermissionItem
                icon={<SpeakerIcon enabled={streams.systemAudio} />}
                title="System audio"
                description="Capture audio from meeting apps and browser tabs"
                enabled={streams.systemAudio}
                onChange={(enabled) => setStreams({ systemAudio: enabled })}
                isFirst
              />
              <div className="h-[1px] bg-[#ededf3]" />
              <PermissionItem
                icon={<MicIcon enabled={streams.microphone} />}
                title="Microphone"
                description="Record your voice during meetings and calls"
                enabled={streams.microphone}
                onChange={(enabled) => setStreams({ microphone: enabled })}
              />
              <div className="h-[1px] bg-[#ededf3]" />
              <PermissionItem
                icon={<ScreenIcon enabled={streams.screen} />}
                title="Screen capture"
                description="Record your screen to capture visual context"
                enabled={streams.screen}
                onChange={(enabled) => setStreams({ screen: enabled })}
              />
              <div className="h-[1px] bg-[#ededf3]" />
              <PermissionItem
                icon={<NotificationIcon enabled={notificationsEnabled} />}
                title="App notification"
                description="Allow call.md to send notification and reminders"
                enabled={notificationsEnabled}
                onChange={handleToggleNotifications}
                isLast
              />
            </div>
          </div>
        </div>

        {/* Recent Meetings Section */}
        <div className="flex flex-col gap-[14px]">
          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <h2 className="text-[18px] font-semibold text-[#141420] tracking-[-0.17px] leading-[25.5px]">
              Recent meetings
            </h2>
          </div>

          {/* Content */}
          {recordingsLoading ? (
            <div className="flex items-center justify-center py-[40px] bg-[#f7f7f7] border border-[#efefef] rounded-[16px] w-full">
              <Loader2 className="w-6 h-6 animate-spin text-[#969696]" />
            </div>
          ) : recentRecordings.length === 0 ? (
            <div className="flex items-center justify-center py-[40px] bg-[#f7f7f7] border border-[#efefef] rounded-[16px] w-full">
              <div className="flex flex-col items-center gap-[10px] px-[8px] py-[14px]">
                <EmptyRecordingsIcon />
                <p className="text-[14px] text-[#141420] leading-[19.5px]">No recordings yet</p>
                <p className="text-[12px] text-[#969696] text-center max-w-[264px] leading-normal">
                  Your recorded meetings will appear here with AI summaries, transcripts, and action items.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-[20px] w-full">
                {recentRecordings.map((recording) => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    onClick={() => setSelectedRecordingId(recording.id)}
                  />
                ))}
              </div>
              <button
                onClick={onNavigateToHistory}
                className="flex items-center justify-center gap-[4px] bg-white border border-[rgba(150,150,150,0.3)] px-[20px] py-[12px] rounded-[12px] hover:bg-gray-50 transition-colors"
              >
                <span className="text-[14px] font-semibold text-black tracking-[-0.28px]">
                  View all
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div
        className={`w-[460px] shrink-0 bg-[#f7f7f7] border border-[#efefef] rounded-[16px] p-[16px] flex flex-col gap-[16px] overflow-y-auto ${scrollbarBaseStyles} ${rightScrollbar.isScrolling ? scrollbarVisibleStyles : scrollbarHiddenStyles}`}
        onScroll={rightScrollbar.handleScroll}
      >
        {/* Today Section */}
        <div className="bg-white border border-[#efefef] rounded-[16px] p-[16px] flex flex-col gap-[20px]">
          {/* Header */}
          <div className="flex items-center gap-[4px]">
            <CalendarIcon />
            <span className="flex-1 text-[18px] font-medium text-black">Today</span>
            {calendarStatus === 'connected' && (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="flex items-center gap-[4px] text-[14px] font-semibold text-[#ec5b16] hover:opacity-80"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="6" stroke="#ec5b16" strokeWidth="1.25" />
                  <path d="M5.5 8h5" stroke="#ec5b16" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
                Disconnect Calendar
              </button>
            )}
          </div>

          {/* Content */}
          {calendarStatus === 'loading' ? (
            <div className="flex items-center justify-center py-[32px]">
              <Loader2 className="w-6 h-6 animate-spin text-[#969696]" />
            </div>
          ) : calendarStatus === 'disconnected' ? (
            <div className="flex flex-col items-center gap-[16px] px-[8px] py-[16px]">
              <EmptyCalendarIcon />
              <div className="flex flex-col items-center gap-[8px]">
                <p className="text-[16px] font-medium text-black text-center leading-[20px]">
                  Connect your calendar
                </p>
                <p className="text-[13px] text-[#969696] text-center leading-[19px]">
                  See upcoming meetings and choose which ones to record.
                </p>
              </div>
              <button
                onClick={handleConnectCalendar}
                className="flex items-center gap-[6px] bg-white border border-[#e4e4ec] px-[16px] py-[12px] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] hover:bg-gray-50 transition-colors"
              >
                <GoogleIcon />
                <span className="text-[14px] font-medium text-black">Connect Google Calendar</span>
              </button>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-[16px] px-[8px] py-[16px]">
              <EmptyCalendarIcon />
              <div className="flex flex-col items-center gap-[8px]">
                <p className="text-[16px] font-medium text-black text-center leading-[20px]">
                  No meeting today
                </p>
                <p className="text-[13px] text-[#969696] text-center leading-[19px]">
                  Enjoy your free day — or start an ad-hoc recording.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[10px]">
              {upcomingEvents.map((event) => (
                <CalendarEventItem
                  key={event.id}
                  event={event}
                  notifyEnabled={eventNotifications[event.id] ?? true}
                  onToggleNotify={(enabled) =>
                    setEventNotifications((prev) => ({ ...prev, [event.id]: enabled }))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* MCPs Section */}
        <div className="bg-white border border-[#efefef] rounded-[16px] p-[16px] flex flex-col gap-[20px]">
          {/* Header */}
          <div className="flex items-center gap-[4px]">
            <MCPIcon />
            <span className="flex-1 text-[18px] font-medium text-black">MCPs</span>
            <button
              onClick={() => onNavigateToSettings('mcpServers')}
              className="flex items-center gap-[4px] text-[14px] font-semibold text-[#ec5b16] hover:opacity-80"
            >
              <span>+</span>
              <span>Add</span>
            </button>
          </div>

          {/* Content */}
          {connectedServers.length === 0 ? (
            <div className="flex flex-col items-center gap-[16px] px-[8px] py-[16px]">
              <EmptyMCPIcon />
              <div className="flex flex-col items-center gap-[8px]">
                <p className="text-[16px] font-medium text-black text-center leading-[20px]">
                  Connect your tools
                </p>
                <p className="text-[13px] text-[#969696] text-center leading-[19px]">
                  Sync meeting notes and action items to Notion, HubSpot, Coda, and more.
                </p>
              </div>
              <button
                onClick={() => onNavigateToSettings('mcpServers')}
                className="flex items-center gap-[4px] bg-white border border-[#e4e4ec] px-[16px] py-[12px] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] hover:bg-gray-50 transition-colors"
              >
                <span className="text-[14px]">+</span>
                <span className="text-[14px] font-medium text-black">Add integration</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-[12px]">
              {connectedServers.map((server) => (
                <MCPServerItem
                  key={server.id}
                  server={server}
                  onRemove={() => window.electronAPI.mcp.disconnect(server.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Workflows Section */}
        <div className="bg-white border border-[#efefef] rounded-[16px] p-[16px] flex flex-col gap-[20px]">
          {/* Header */}
          <div className="flex items-center gap-[4px]">
            <WorkflowIcon />
            <span className="flex-1 text-[18px] font-medium text-black">Workflows</span>
            <button
              onClick={() => onNavigateToSettings('workflows')}
              className="flex items-center gap-[4px] text-[14px] font-semibold text-[#ec5b16] hover:opacity-80"
            >
              <span>+</span>
              <span>Add</span>
            </button>
          </div>

          {/* Content */}
          {workflows.length === 0 ? (
            <div className="flex flex-col items-center gap-[16px] px-[8px] py-[16px]">
              <EmptyWorkflowIcon />
              <div className="flex flex-col items-center gap-[8px]">
                <p className="text-[16px] font-medium text-black text-center leading-[20px]">
                  No workflows yet
                </p>
                <p className="text-[13px] text-[#969696] text-center leading-[19px]">
                  Send meeting data to n8n, Zapier, and other automation tools.
                </p>
              </div>
              <button
                onClick={() => onNavigateToSettings('workflows')}
                className="flex items-center gap-[4px] bg-white border border-[#e4e4ec] px-[16px] py-[12px] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] hover:bg-gray-50 transition-colors"
              >
                <span className="text-[14px]">+</span>
                <span className="text-[14px] font-medium text-black">Add workflow</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-[12px]">
              {workflows.map((workflow) => (
                <WorkflowItem
                  key={workflow.id}
                  workflow={workflow}
                  onEdit={() => onNavigateToSettings('workflows')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Disconnect Calendar Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDisconnectConfirm}
        title="Disconnect Calendar"
        message="Are you sure you want to disconnect your Google Calendar? You won't receive meeting reminders until you reconnect."
        confirmText="Disconnect"
        cancelText="Cancel"
        onConfirm={handleDisconnectCalendar}
        onCancel={() => setShowDisconnectConfirm(false)}
        variant="danger"
      />
    </div>
  );
}

export default HomeView;
