import React, { useState } from 'react';
import logoIcon from '../../resources/icon-color-black-bg.png';
import permissionsVideo from '../../resources/permissions.mp4';
import { NewSidebar } from './components/layout/NewSidebar';
import { AuthView } from './components/auth/AuthView';
import { TopStatusBar } from './components/recording/TopStatusBar';
import { TranscriptionPanel } from './components/transcription/TranscriptionPanel';
import { HistoryView } from './components/history/HistoryView';
import { HomeView } from './components/home/HomeView';
import { useConfigStore } from './stores/config.store';
import { useSession } from './hooks/useSession';
import { useSessionStore } from './stores/session.store';
import { usePermissions } from './hooks/usePermissions';
import { useGlobalRecorderEvents } from './hooks/useGlobalRecorderEvents';
import { useCopilot } from './hooks/useCopilot';
import { ErrorToast } from './components/ui/error-toast';
import { AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './components/ui/dialog';
import {
  NudgeToast,
  CallSummaryView,
} from './components/copilot';
import { useCopilotStore } from './stores/copilot.store';
import { useMeetingSetupStore } from './stores/meeting-setup.store';
import { useSessionLifecycle, resetAllSessionStores } from './hooks/useSessionLifecycle';
import { SettingsView } from './components/settings/SettingsView';
import { CalendarAuthBanner } from './components/calendar';
import { MeetingSetupFlow } from './components/meeting-setup';
import { StepIndicators } from './components/auth/AuthView';
import { CalendarSetupView } from './components/auth/CalendarSetupView';
import { RecordingPreferencesView } from './components/auth/RecordingPreferencesView';
import { RecordingHeader, MetricsBar, LiveAssistPanel, MeetingAgendaPanel } from './components/recording';
import { useNotificationPermission } from './hooks/useNotificationPermission';

type Tab = 'home' | 'history' | 'settings';

function LogoIcon() {
  return <img src={logoIcon} width={50} height={50} alt="Call.md" />;
}

// System audio icon
function SystemAudioIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3.33334V16.6667" stroke="#EC5B16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83334 6.66666V13.3333" stroke="#EC5B16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.1667 6.66666V13.3333" stroke="#EC5B16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66666 8.33334V11.6667" stroke="#EC5B16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.3333 8.33334V11.6667" stroke="#EC5B16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Microphone icon
function MicrophoneIcon({ color = "#EC5B16" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 1.66666C9.11594 1.66666 8.26809 2.01785 7.643 2.643C7.0179 3.26809 6.66671 4.11594 6.66671 5V10C6.66671 10.8841 7.0179 11.7319 7.643 12.357C8.26809 12.9821 9.11594 13.3333 10 13.3333C10.8841 13.3333 11.732 12.9821 12.357 12.357C12.9822 11.7319 13.3334 10.8841 13.3334 10V5C13.3334 4.11594 12.9822 3.26809 12.357 2.643C11.732 2.01785 10.8841 1.66666 10 1.66666Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.6667 8.33334V10C16.6667 11.7681 15.9643 13.4638 14.714 14.714C13.4638 15.9643 11.7681 16.6667 10 16.6667C8.23189 16.6667 6.53619 15.9643 5.28595 14.714C4.03571 13.4638 3.33333 11.7681 3.33333 10V8.33334" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 16.6667V18.3333" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Screen capture icon
function ScreenCaptureIcon({ color = "#969696" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.6667 3.33334H3.33333C2.41286 3.33334 1.66666 4.07954 1.66666 5V12.5C1.66666 13.4205 2.41286 14.1667 3.33333 14.1667H16.6667C17.5871 14.1667 18.3333 13.4205 18.3333 12.5V5C18.3333 4.07954 17.5871 3.33334 16.6667 3.33334Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.66666 17.5H13.3333" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 14.1667V17.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Toggle component matching Figma design
function PermissionToggle({ enabled, onClick }: { enabled: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-[38px] h-[22px] rounded-[22px] relative transition-colors ${
        enabled ? 'bg-[#ec5b16]' : 'bg-[#e4e4ec]'
      }`}
    >
      <div
        className={`absolute size-[18px] bg-white rounded-[9px] top-[2px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.15)] transition-all ${
          enabled ? 'left-[18px]' : 'left-[2px]'
        }`}
      />
    </button>
  );
}


// Notification icon for permissions
function NotificationIcon({ color = "#969696" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2.5C7.5 2.5 5.5 4.5 5.5 7v3.5l-1.25 1.25c-.417.417-.125 1.125.458 1.125h10.584c.583 0 .875-.708.458-1.125L14.5 10.5V7c0-2.5-2-4.5-4.5-4.5z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 15.833a1.667 1.667 0 003.333 0"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PermissionsView({ onContinue }: { onContinue: () => void }) {
  const { status, requestMicPermission, openSettings, checkPermissions } = usePermissions();
  const configStore = useConfigStore();
  const { enabled: notificationsEnabled, openSettings: openNotificationSettings } =
    useNotificationPermission();

  const handleToggleNotifications = async () => {
    await openNotificationSettings();
  };

  const allGranted = status.microphone && status.screen;

  const handleContinue = () => {
    if (allGranted) {
      onContinue();
    }
  };

  const handleSkip = () => {
    // Skip entire onboarding - user can configure permissions later from settings
    configStore.completeOnboarding();
  };

  // Check permissions periodically when screen permission is not granted
  React.useEffect(() => {
    if (!status.screen) {
      const interval = setInterval(() => {
        checkPermissions();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status.screen, checkPermissions]);

  return (
    <div className="h-full w-full bg-white flex flex-col relative overflow-hidden">
      {/* Orange gradient glow */}
      <div
        className="absolute top-[-22.76%] left-1/2 -translate-x-1/2 w-[600px] h-[566px] rounded-[300px] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(236,91,22,0.08) 0%, rgba(236,91,22,0) 70%)',
        }}
      />

      {/* Step indicators */}
      <div className="absolute top-[32px] left-1/2 -translate-x-1/2">
        <StepIndicators currentStep={1} totalSteps={4} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center gap-[60px] p-[60px]">
        {/* Left side - Permissions */}
        <div className="flex flex-col gap-[32px] w-[548px] relative z-10">
          {/* Logo and heading */}
          <div className="flex flex-col gap-[20px]">
            <LogoIcon />
            <div className="flex flex-col">
              <h1 className="text-[22px] font-semibold text-black tracking-[-0.44px] leading-[32px]">
                Before we start,
              </h1>
              <h1 className="text-[22px] font-semibold text-black tracking-[-0.44px] leading-[32px]">
                grant a few permissions
              </h1>
            </div>
          </div>

          {/* Permission items */}
          <div className="flex flex-col gap-[10px] w-full">
            {/* System audio permission */}
            <div
              className={`flex gap-[14px] items-center px-[17px] py-[15px] rounded-[16px] border ${
                status.screen
                  ? 'bg-[#fff5ec] border-[#ffe9d3]'
                  : 'bg-white border-[#efefef]'
              }`}
            >
              <div
                className={`size-[36px] rounded-[10px] flex items-center justify-center border ${
                  status.screen
                    ? 'bg-[rgba(236,91,22,0.1)] border-[rgba(236,91,22,0.3)]'
                    : 'bg-white border-[#ededf3]'
                }`}
              >
                <SystemAudioIcon />
              </div>
              <div className="flex-1 flex flex-col gap-[3px]">
                <p className="text-[16px] font-medium text-[#141420] leading-[20px]">System audio</p>
                <p className="text-[13px] font-normal text-[#969696] leading-[18px]">
                  Capture audio from meeting apps like Zoom, Meet, and Teams.
                </p>
              </div>
              <PermissionToggle
                enabled={status.screen}
                onClick={() => !status.screen && openSettings('screen')}
              />
            </div>

            {/* Microphone permission */}
            <div
              className={`flex gap-[14px] items-center px-[17px] py-[15px] rounded-[16px] border ${
                status.microphone
                  ? 'bg-[#fff5ec] border-[#ffe9d3]'
                  : 'bg-white border-[#efefef]'
              }`}
            >
              <div
                className={`size-[36px] rounded-[10px] flex items-center justify-center border ${
                  status.microphone
                    ? 'bg-[rgba(236,91,22,0.1)] border-[rgba(236,91,22,0.3)]'
                    : 'bg-white border-[#ededf3]'
                }`}
              >
                <MicrophoneIcon color={status.microphone ? '#EC5B16' : '#969696'} />
              </div>
              <div className="flex-1 flex flex-col gap-[3px]">
                <p className="text-[16px] font-medium text-[#141420] leading-[20px]">Microphone</p>
                <p className="text-[13px] font-normal text-[#969696] leading-[18px]">
                  Record your voice during meetings and calls.
                </p>
              </div>
              <PermissionToggle
                enabled={status.microphone}
                onClick={() => !status.microphone && requestMicPermission()}
              />
            </div>

            {/* Screen capture permission */}
            <div
              className={`flex gap-[14px] items-center px-[17px] py-[15px] rounded-[16px] border ${
                status.screen
                  ? 'bg-[#fff5ec] border-[#ffe9d3]'
                  : 'bg-white border-[#efefef]'
              }`}
            >
              <div
                className={`size-[36px] rounded-[10px] flex items-center justify-center border ${
                  status.screen
                    ? 'bg-[rgba(236,91,22,0.1)] border-[rgba(236,91,22,0.3)]'
                    : 'bg-white border-[#ededf3]'
                }`}
              >
                <ScreenCaptureIcon color={status.screen ? '#EC5B16' : '#969696'} />
              </div>
              <div className="flex-1 flex flex-col gap-[3px]">
                <p className="text-[16px] font-medium text-[#141420] leading-[20px]">Screen capture</p>
                <p className="text-[13px] font-normal text-[#969696] leading-[18px]">
                  Record your screen to capture shared content and visual context.
                </p>
              </div>
              <PermissionToggle
                enabled={status.screen}
                onClick={() => !status.screen && openSettings('screen')}
              />
            </div>
          </div>

          {/* App notifications permission */}
          <div
            className={`flex gap-[14px] items-center px-[17px] py-[15px] rounded-[16px] border ${
              notificationsEnabled
                ? 'bg-[#fff5ec] border-[#ffe9d3]'
                : 'bg-white border-[#efefef]'
            }`}
          >
            <div
              className={`size-[36px] rounded-[10px] flex items-center justify-center border ${
                notificationsEnabled
                  ? 'bg-[rgba(236,91,22,0.1)] border-[rgba(236,91,22,0.3)]'
                  : 'bg-white border-[#ededf3]'
              }`}
            >
              <NotificationIcon color={notificationsEnabled ? '#EC5B16' : '#969696'} />
            </div>
            <div className="flex-1 flex flex-col gap-[3px]">
              <p className="text-[16px] font-medium text-[#141420] leading-[20px]">App notifications</p>
              <p className="text-[13px] font-normal text-[#969696] leading-[18px]">
                Get alerts before your meetings start.
              </p>
            </div>
            <PermissionToggle
              enabled={notificationsEnabled}
              onClick={handleToggleNotifications}
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-[10px] w-full">
            <button
              onClick={handleContinue}
              disabled={!allGranted}
              className="w-full bg-[#ff4000] hover:bg-[#e63900] disabled:bg-[#ffb399] disabled:cursor-not-allowed rounded-[12px] px-[24px] py-[12px] text-[16px] font-semibold text-white text-center leading-[22.5px] transition-colors"
            >
              Continue to setup
            </button>
          </div>
        </div>

        {/* Right side - Permissions Video */}
        <div className="flex-1 h-full min-h-[400px] bg-[#f7f7f7] rounded-[16px] overflow-hidden flex items-center justify-center">
          <video
            src={permissionsVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover rounded-[16px]"
          />
        </div>
      </div>
    </div>
  );
}

interface RecordingViewProps {
  onBack?: () => void;
}

function RecordingView({ onBack }: RecordingViewProps) {
  const { isCallActive, callSummary, nudgeHistory } = useCopilotStore();
  const { status } = useSession();
  const meetingSetupStore = useMeetingSetupStore();
  const { prepareNewSession } = useSessionLifecycle();

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'stopping';
  const isIdle = status === 'idle';

  console.log('[RecordingView] status:', status, 'isIdle:', isIdle, 'callSummary:', !!callSummary);

  // Handle navigation when session becomes idle and call summary is ready
  // Only trigger if we were previously recording (not on initial mount edge case)
  const wasRecordingRef = React.useRef(false);
  React.useEffect(() => {
    if (isRecording) {
      wasRecordingRef.current = true;
    }
    // Navigate to detail page when call summary is ready (after recording ended)
    if (callSummary && wasRecordingRef.current) {
      console.log('[RecordingView] Call summary ready, navigating to recording detail page');
      onBack?.();
    }
  }, [callSummary, isRecording, onBack]);

  // Get checklist from meeting setup
  const { checklist } = meetingSetupStore;
  const hasChecklist = checklist.length > 0;

  // Get insights from nudge history (for Live Assist panel)
  const insights = nudgeHistory
    .filter((n) => n.type === 'suggestion' || n.type === 'question')
    .map((n) => n.message)
    .slice(-5); // Last 5 insights

  // MCP findings placeholder - will be populated from MCP store
  const mcpFindings = ''; // TODO: Connect to MCP results

  useCopilot();

  // Reset all session state when starting a new call
  const handleStartNewCall = () => {
    prepareNewSession();
  };

  // Go back to home - clear all session state
  const handleGoBack = () => {
    prepareNewSession();
    onBack?.();
  };

  // Show call summary view if call ended and summary available
  if (callSummary && !isCallActive) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopStatusBar />
        <div className="flex-1 overflow-hidden p-6">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-[18px] font-semibold text-[#141420]">Call Complete</h2>
              <div className="flex gap-[8px]">
                <button
                  onClick={handleGoBack}
                  className="px-[14px] py-[8px] border border-[#ededf3] rounded-[10px] text-[13px] font-medium text-[#464646] hover:bg-[#f7f7f7] transition-colors"
                >
                  Back to Home
                </button>
                <button
                  onClick={handleStartNewCall}
                  className="px-[14px] py-[8px] bg-[#ec5b16] hover:bg-[#d9520f] rounded-[10px] text-[13px] font-medium text-white transition-colors"
                >
                  Start New Call
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <CallSummaryView />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show processing state while generating summary (only after recording stopped)
  if (isProcessing) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[#f7f7f7]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#fff5ec] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#ec5b16] animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Generating Call Summary</h2>
              <p className="text-sm text-[#464646] mt-1">
                Analyzing your conversation and preparing insights...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If idle with no summary, the useEffect above handles navigation
  // Return null to prevent flash of recording UI
  if (isIdle && !callSummary) {
    return null;
  }

  // Show recording view with new Figma design
  return (
    <div className="flex flex-col h-full bg-[#f7f7f7]">
      {/* Header */}
      <RecordingHeader />

      {/* Main Container */}
      <div className="flex-1 bg-white border border-[#efefef] rounded-t-[20px] mx-[10px] p-[20px] flex gap-[30px] overflow-hidden">
        {/* Left Column - Live Assist Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <LiveAssistPanel />
        </div>

        {/* Right Column - Metrics, Agenda, Transcript */}
        <div className="w-[460px] shrink-0 flex flex-col gap-[13px] h-full">
          {/* Metrics Bar */}
          <MetricsBar />

          {/* Right Panel with scrollable content */}
          <div className="flex-1 bg-[#f7f7f7] border border-[#efefef] rounded-[16px] p-[12px] flex flex-col gap-[16px] overflow-hidden min-h-0">
            {/* Meeting Agenda - only show if checklist exists */}
            {hasChecklist && <MeetingAgendaPanel checklist={checklist} />}

            {/* Meeting Transcript */}
            <TranscriptionPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showRecordingPrefs, setShowRecordingPrefs] = useState(false);
  const [showMeetingSetup, setShowMeetingSetup] = useState(false);
  const [pendingOverlap, setPendingOverlap] = useState<{
    currentMeeting?: { id: string; summary: string };
    nextMeeting: { id: string; summary: string; description?: string };
  } | null>(null);
  // Recording ID to navigate to after recording ends
  const [pendingRecordingNavigation, setPendingRecordingNavigation] = useState<number | null>(null);
  // Settings tab to show when navigating to settings
  const [initialSettingsTab, setInitialSettingsTab] = useState<'account' | 'notifications' | 'mcpServers' | 'workflows' | null>(null);
  // Pending tab change when user needs to confirm discarding meeting setup
  const [pendingTabChange, setPendingTabChange] = useState<Tab | null>(null);

  const configStore = useConfigStore();
  const sessionStore = useSessionStore();
  const meetingSetupStore = useMeetingSetupStore();

  // Check if meeting setup has any user-entered data
  const hasMeetingSetupData = () => {
    return (
      meetingSetupStore.name.trim().length > 0 ||
      meetingSetupStore.description.trim().length > 0 ||
      meetingSetupStore.questions.length > 0 ||
      meetingSetupStore.checklist.length > 0
    );
  };

  // Handle tab change with meeting setup check
  const handleTabChange = (tab: Tab) => {
    // If we're in meeting setup mode and trying to navigate away
    if (showMeetingSetup && activeTab === 'home' && tab !== 'home') {
      if (hasMeetingSetupData()) {
        // Has data - show confirmation
        setPendingTabChange(tab);
        return;
      }
      // No data - just close and navigate
      setShowMeetingSetup(false);
      meetingSetupStore.reset();
    }

    // If clicking home while meeting setup is showing (no data), clear it
    if (showMeetingSetup && tab === 'home') {
      if (!hasMeetingSetupData()) {
        setShowMeetingSetup(false);
        meetingSetupStore.reset();
      }
      // If has data and clicking home, just show the dashboard
      setShowMeetingSetup(false);
      meetingSetupStore.reset();
    }

    setActiveTab(tab);
  };

  // Confirm discarding meeting setup and navigate
  const confirmDiscardMeetingSetup = () => {
    if (pendingTabChange) {
      setShowMeetingSetup(false);
      meetingSetupStore.reset();
      setActiveTab(pendingTabChange);
      setPendingTabChange(null);
    }
  };

  // Cancel discarding meeting setup
  const cancelDiscardMeetingSetup = () => {
    setPendingTabChange(null);
  };
  const { status: sessionStatus, startRecording, stopRecording } = useSession();
  const { allGranted, loading: permissionsLoading, checkPermissions } = usePermissions();
  const { prepareNewSession, prepareNewSessionWithInfo, waitForIdle } = useSessionLifecycle();

  // Global listener for recorder events - persists during navigation
  useGlobalRecorderEvents();

  const isAuthenticated = configStore.isAuthenticated();

  // Listen for calendar notification events
  React.useEffect(() => {
    if (!isAuthenticated) return;

    // Handle "open meeting setup" from notification/tray click
    const unsubOpenSetup = window.electronAPI.calendarOn.onOpenMeetingSetup((meeting) => {
      // Clear all stale state and pre-fill meeting info
      prepareNewSessionWithInfo(meeting.summary, meeting.description || '');

      // Switch to home tab and show meeting setup
      setActiveTab('home');
      setShowMeetingSetup(true);
    });

    // Handle "auto-start recording" from notification or default_record behavior
    const unsubAutoStart = window.electronAPI.calendarOn.onAutoStartRecording(async (meeting) => {
      // Clear ALL stale state (including old call summaries) before starting new recording
      prepareNewSessionWithInfo(meeting.summary, meeting.description || '');

      // Ensure we're on home tab
      setActiveTab('home');

      // Notify main process about which meeting we're recording (for overlapping detection)
      await window.electronAPI.calendar.setRecordingMeeting(meeting.id);

      // Start recording directly with meeting data
      await startRecording({
        name: meeting.summary,
        description: meeting.description || '',
        questions: [],
        checklist: [],
      });
    });

    // Handle overlapping meeting notification
    const unsubOverlap = window.electronAPI.calendarOn.onOverlappingMeeting((data) => {
      // Store the overlap data for handling
      setPendingOverlap({
        currentMeeting: data.currentMeeting ? {
          id: data.currentMeeting.id,
          summary: data.currentMeeting.summary,
        } : undefined,
        nextMeeting: {
          id: data.nextMeeting.id,
          summary: data.nextMeeting.summary,
          description: data.nextMeeting.description,
        },
      });
    });

    return () => {
      unsubOpenSetup();
      unsubAutoStart();
      unsubOverlap();
    };
  }, [isAuthenticated, startRecording, prepareNewSessionWithInfo]);

  // Handle pending overlap action (stop current, start next)
  React.useEffect(() => {
    const handleOverlap = async () => {
      if (!pendingOverlap) return;

      const { nextMeeting } = pendingOverlap;

      // Stop current recording
      await stopRecording();

      // Clear the current recording meeting
      await window.electronAPI.calendar.setRecordingMeeting(null);

      // Wait for session to properly reach idle state (no arbitrary timeout)
      await waitForIdle();

      // Clear all stale state before starting next meeting
      prepareNewSessionWithInfo(nextMeeting.summary, nextMeeting.description || '');

      // Notify main process about new meeting we're recording
      await window.electronAPI.calendar.setRecordingMeeting(nextMeeting.id);

      // Start recording with next meeting
      await startRecording({
        name: nextMeeting.summary,
        description: nextMeeting.description || '',
        questions: [],
        checklist: [],
      });

      setPendingOverlap(null);
    };

    if (pendingOverlap) {
      handleOverlap();
    }
  }, [pendingOverlap, stopRecording, startRecording, waitForIdle, prepareNewSessionWithInfo]);

  // Clear recording meeting when session becomes idle
  React.useEffect(() => {
    if (sessionStatus === 'idle') {
      window.electronAPI.calendar.setRecordingMeeting(null);
    }
  }, [sessionStatus]);

  // Handle clearing session errors
  const handleDismissError = () => {
    sessionStore.setError(null);
  };

  // Check if we need to show calendar setup (onboarding not complete)
  const needsCalendarSetup = isAuthenticated && allGranted && !configStore.onboardingComplete;

  // Check if actively recording or processing
  const isActivelyRecording = sessionStatus === 'recording' || sessionStatus === 'processing' || sessionStatus === 'stopping' || sessionStatus === 'starting';

  // Track if we're waiting for call summary after recording ended
  const copilotCallActive = useCopilotStore((state) => state.isCallActive);
  const awaitingCallSummary = sessionStatus === 'idle' && copilotCallActive;

  React.useEffect(() => {
    if (isActivelyRecording && showMeetingSetup) {
      setShowMeetingSetup(false);
    }
  }, [isActivelyRecording, showMeetingSetup]);

  // Handle start recording button from HomeView - show MeetingSetupFlow
  const handleStartRecording = () => {
    prepareNewSession();  // Clear any stale state from previous sessions
    setShowMeetingSetup(true);
  };

  // Handle returning from recording/setup mode - navigate to history (detail page if we have a recording ID)
  const handleExitRecordingMode = () => {
    setShowMeetingSetup(false);

    // Capture recording ID before clearing state (may be null if something went wrong)
    const recordingId = sessionStore.recordingId;
    if (recordingId) {
      setPendingRecordingNavigation(recordingId);
    }

    // Always navigate to history - shows detail if we have ID, otherwise shows list
    setActiveTab('history');

    prepareNewSession();
  };

  const renderContent = () => {
    console.log('[App.renderContent] sessionStatus:', sessionStatus, 'isActivelyRecording:', isActivelyRecording, 'awaitingCallSummary:', awaitingCallSummary, 'activeTab:', activeTab);

    // Step 0: Auth
    if (!isAuthenticated) {
      return <AuthView />;
    }

    // Step 1: Permissions (loading state)
    if (permissionsLoading) {
      return (
        <div className="h-full w-full bg-[#f8f8fa] flex flex-col items-center justify-center relative overflow-hidden">
          {/* Orange gradient glow */}
          <div
            className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[600px] h-[567px] rounded-[300px] pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at center, rgba(236,91,22,0.08) 0%, rgba(236,91,22,0) 70%)',
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[#ec5b16] animate-spin" />
            <p className="text-[14px] text-[#464646]">Checking permissions...</p>
          </div>
        </div>
      );
    }

    // Step 1: Permissions
    if (!allGranted && activeTab === 'home') {
      return <PermissionsView onContinue={checkPermissions} />;
    }

    // Step 2: Calendar setup (only on home tab and during onboarding)
    if (needsCalendarSetup && activeTab === 'home' && !showRecordingPrefs) {
      return (
        <CalendarSetupView
          onConnected={() => setShowRecordingPrefs(true)}
          onSkip={() => {}}
        />
      );
    }

    // Step 3: Recording preferences (after calendar connected)
    if (showRecordingPrefs && activeTab === 'home') {
      return (
        <RecordingPreferencesView
          onComplete={() => {
            setShowRecordingPrefs(false);
            configStore.completeOnboarding();
          }}
        />
      );
    }

    // If actively recording OR waiting for call summary, show RecordingView
    if ((isActivelyRecording || awaitingCallSummary) && activeTab === 'home') {
      return <RecordingView onBack={handleExitRecordingMode} />;
    }

    // If showing meeting setup flow (after clicking Start Recording from HomeView)
    if (showMeetingSetup && activeTab === 'home') {
      return (
        <div className="flex flex-col h-full bg-white">
          <div className="flex-1 flex items-center justify-center overflow-auto py-8">
            <MeetingSetupFlow onCancel={() => setShowMeetingSetup(false)} />
          </div>
        </div>
      );
    }

    // Main app
    switch (activeTab) {
      case 'home':
        return (
          <HomeView
            onStartRecording={handleStartRecording}
            onNavigateToHistory={() => setActiveTab('history')}
            onNavigateToSettings={(tab) => {
              if (tab) setInitialSettingsTab(tab);
              setActiveTab('settings');
            }}
          />
        );
      case 'history':
        return (
          <HistoryView
            initialSelectedRecordingId={pendingRecordingNavigation}
            onClearInitialSelection={() => setPendingRecordingNavigation(null)}
          />
        );
      case 'settings':
        return (
          <SettingsView
            initialTab={initialSettingsTab}
            onClearInitialTab={() => setInitialSettingsTab(null)}
          />
        );
    }
  };

  // Determine if we're in the setup flow (auth, permissions, calendar setup, or recording prefs)
  const isSetupFlow = !isAuthenticated ||
    (activeTab === 'home' && (permissionsLoading || !allGranted || needsCalendarSetup || showRecordingPrefs));

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Title bar - minimal for setup flow, hidden in main app (new design has no title bar) */}
      <div
        className={`flex items-center shrink-0 drag-region relative ${
          isSetupFlow
            ? 'h-[50px] bg-[#f8f8fa] border-b border-black/10'
            : 'h-[50px] bg-white border-b border-black/10'
        }`}
      >
        {/* Space for traffic lights */}
        <div className="absolute left-0 w-20 shrink-0" />
      </div>

      {/* Calendar Auth Banner (shows when calendar needs reconnection) */}
      {isAuthenticated && !isSetupFlow && <CalendarAuthBanner />}

      {/* Main layout below titlebar */}
      <div className="flex flex-1 overflow-hidden">
        {isAuthenticated && !isSetupFlow && (
          <NewSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        )}
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </div>

      {/* Global Copilot Components */}
      {isAuthenticated && <NudgeToast position="bottom" />}
      <ErrorToast
        message={sessionStore.error}
        onDismiss={handleDismissError}
        position="bottom"
      />

      {/* Discard Meeting Setup Confirmation Dialog */}
      <Dialog open={pendingTabChange !== null} onOpenChange={(open) => !open && cancelDiscardMeetingSetup()}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-[12px]">
              <div className="w-[40px] h-[40px] bg-[rgba(209,36,47,0.1)] rounded-[10px] flex items-center justify-center">
                <AlertTriangle className="w-[20px] h-[20px] text-[#d1242f]" />
              </div>
              <div>
                <DialogTitle className="text-[16px] font-semibold text-[#141420]">
                  Discard meeting setup?
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-[14px] text-[#464646] mt-[12px]">
              You have unsaved changes in your meeting setup. If you leave now, your progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-[8px] mt-[16px]">
            <button
              onClick={cancelDiscardMeetingSetup}
              className="flex-1 px-[16px] py-[10px] border border-[#ededf3] rounded-[10px] text-[14px] font-medium text-[#464646] hover:bg-[#f7f7f7] transition-colors"
            >
              Keep editing
            </button>
            <button
              onClick={confirmDiscardMeetingSetup}
              className="flex-1 px-[16px] py-[10px] bg-[#d1242f] hover:bg-[#b91c1c] rounded-[10px] text-[14px] font-medium text-white transition-colors"
            >
              Discard
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
