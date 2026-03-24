import React, { useState } from 'react';
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
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  NudgeToast,
  CallSummaryView,
} from './components/copilot';
import { useCopilotStore } from './stores/copilot.store';
import { useMeetingSetupStore } from './stores/meeting-setup.store';
import { MCPServersPanel } from './components/settings/MCPServersPanel';
import { CalendarPanel } from './components/settings/CalendarPanel';
import { WorkflowsPanel } from './components/settings/WorkflowsPanel';
import { CalendarAuthBanner } from './components/calendar';
import { MeetingSetupFlow } from './components/meeting-setup';
import { StepIndicators } from './components/auth/AuthView';
import { CalendarSetupView } from './components/auth/CalendarSetupView';
import { RecordingPreferencesView } from './components/auth/RecordingPreferencesView';
import { RecordingHeader, MetricsBar, LiveAssistPanel, MeetingAgendaPanel } from './components/recording';

type Tab = 'home' | 'history' | 'settings';

// Logo icon for permissions
function LogoIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="50" height="50" rx="12" fill="#EC5B16" />
    </svg>
  );
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

// Step indicators for permissions (4 steps)
function PermissionStepIndicators() {
  return (
    <div className="flex gap-[6px] items-center justify-center">
      <div className="w-[24px] h-[6px] bg-[#ec5b16] rounded-[3px]" />
      <div className="size-[6px] bg-[#e0e0e8] rounded-[3px]" />
      <div className="size-[6px] bg-[#e0e0e8] rounded-[3px]" />
      <div className="size-[6px] bg-[#e0e0e8] rounded-[3px]" />
    </div>
  );
}

function PermissionsView() {
  const { status, requestMicPermission, openSettings, checkPermissions } = usePermissions();
  const configStore = useConfigStore();

  const allGranted = status.microphone && status.screen;

  const handleContinue = () => {
    if (allGranted) {
      // Move to next step (calendar setup)
    }
  };

  const handleSkip = () => {
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
        <PermissionStepIndicators />
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

          {/* Buttons */}
          <div className="flex flex-col gap-[10px] w-full">
            <button
              onClick={handleContinue}
              disabled={!allGranted}
              className="w-full bg-[#ff4000] hover:bg-[#e63900] disabled:bg-[#ffb399] disabled:cursor-not-allowed rounded-[12px] px-[24px] py-[12px] text-[16px] font-semibold text-white text-center leading-[22.5px] transition-colors"
            >
              Continue to setup
            </button>
            <button
              onClick={handleSkip}
              className="w-full py-[6px] text-[14px] font-normal text-[#969696] text-center leading-[18px] hover:text-[#464646] transition-colors"
            >
              I will do it later
            </button>
          </div>
        </div>

        {/* Right side - Placeholder */}
        <div className="flex-1 h-full min-h-[400px] bg-[#f7f7f7] rounded-[16px]" />
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

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'stopping';
  const isIdle = status === 'idle';

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

  // Reset meeting setup when starting a new call
  const handleStartNewCall = () => {
    useCopilotStore.getState().reset();
    meetingSetupStore.reset();
  };

  // Go back to home
  const handleGoBack = () => {
    useCopilotStore.getState().reset();
    meetingSetupStore.reset();
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

  // If idle, go back to home (user shouldn't see RecordingView when idle)
  if (isIdle) {
    onBack?.();
    return null;
  }

  // Show recording view with new Figma design
  return (
    <div className="flex flex-col h-full bg-[#f7f7f7]">
      {/* Header */}
      <RecordingHeader />

      {/* Main Container */}
      <div className="flex-1 bg-white border border-[#efefef] rounded-t-[20px] mx-[10px] p-[20px] flex gap-[30px] overflow-hidden">
        {/* Left Column - Transcript Section */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TranscriptionPanel />
        </div>

        {/* Right Column - Metrics, Agenda, Live Assist */}
        <div className="w-[460px] shrink-0 flex flex-col gap-[30px] h-full">
          {/* Metrics Bar */}
          <MetricsBar />

          {/* Right Panel with scrollable content */}
          <div className="flex-1 bg-[#f7f7f7] border border-[#efefef] rounded-[16px] p-[12px] flex flex-col gap-[16px] overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Meeting Agenda - only show if checklist exists */}
            {hasChecklist && <MeetingAgendaPanel checklist={checklist} />}

            {/* Live Assist Panel */}
            <LiveAssistPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'account' | 'calendar' | 'mcpServers' | 'workflows'
  >('account');
  const configStore = useConfigStore();

  const settingsTabs = [
    { id: 'account' as const, label: 'Account' },
    { id: 'calendar' as const, label: 'Calendar' },
    { id: 'mcpServers' as const, label: 'MCP Servers' },
    { id: 'workflows' as const, label: 'Workflows' },
  ];

  return (
    <div className="h-full overflow-auto bg-[#f7f7f7] p-[24px]">
      <div className="max-w-[720px] mx-auto">
        {/* Settings Tabs */}
        <div className="flex gap-[4px] p-[4px] bg-white border border-[#ededf3] rounded-[12px] w-fit mb-[24px]">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id)}
              className={`px-[16px] py-[8px] text-[14px] font-medium rounded-[8px] transition-colors ${
                activeSettingsTab === tab.id
                  ? 'bg-[#ec5b16] text-white'
                  : 'text-[#464646] hover:bg-[#f7f7f7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-[16px]">
          {activeSettingsTab === 'account' && (
            <div className="space-y-[16px]">
              {/* Account Card */}
              <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
                <div className="px-[20px] py-[16px] border-b border-[#ededf3]">
                  <h3 className="text-[16px] font-semibold text-[#141420]">Account</h3>
                </div>
                <div className="px-[20px] py-[16px] space-y-[16px]">
                  <div>
                    <p className="text-[13px] text-[#969696] mb-[4px]">Name</p>
                    <p className="text-[14px] font-medium text-[#141420]">
                      {configStore.userName || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] text-[#969696] mb-[4px]">API Key</p>
                    <p className="text-[13px] font-mono text-[#464646]">
                      {configStore.apiKey ? `${configStore.apiKey.slice(0, 8)}...` : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* About Card */}
              <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
                <div className="px-[20px] py-[16px] border-b border-[#ededf3]">
                  <h3 className="text-[16px] font-semibold text-[#141420]">About</h3>
                </div>
                <div className="px-[20px] py-[16px] space-y-[8px]">
                  <p className="text-[14px] text-[#464646] leading-[20px]">
                    Meeting Copilot is a desktop app for recording meetings with real-time
                    transcription and AI-powered insights.
                  </p>
                  <p className="text-[13px] text-[#969696]">
                    Built with Electron, React, and VideoDB.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab === 'calendar' && <CalendarPanel />}

          {activeSettingsTab === 'mcpServers' && <MCPServersPanel />}

          {activeSettingsTab === 'workflows' && <WorkflowsPanel />}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showRecordingPrefs, setShowRecordingPrefs] = useState(false);
  const [showMeetingSetup, setShowMeetingSetup] = useState(false);

  const configStore = useConfigStore();
  const sessionStore = useSessionStore();
  const { status: sessionStatus } = useSession();
  const { allGranted, loading: permissionsLoading } = usePermissions();

  // Global listener for recorder events - persists during navigation
  useGlobalRecorderEvents();

  const isAuthenticated = configStore.isAuthenticated();

  // Handle clearing session errors
  const handleDismissError = () => {
    sessionStore.setError(null);
  };

  // Check if we need to show calendar setup (onboarding not complete)
  const needsCalendarSetup = isAuthenticated && allGranted && !configStore.onboardingComplete;

  // Check if actively recording or processing
  const isActivelyRecording = sessionStatus === 'recording' || sessionStatus === 'processing' || sessionStatus === 'stopping' || sessionStatus === 'starting';

  React.useEffect(() => {
    if (isActivelyRecording && showMeetingSetup) {
      setShowMeetingSetup(false);
    }
  }, [isActivelyRecording, showMeetingSetup]);

  // Handle start recording button from HomeView - show MeetingSetupFlow
  const handleStartRecording = () => {
    setShowMeetingSetup(true);
  };

  // Handle returning from recording/setup mode
  const handleExitRecordingMode = () => {
    setShowMeetingSetup(false);
    sessionStore.reset();
  };

  const renderContent = () => {
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
      return <PermissionsView />;
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

    // If actively recording, show RecordingView
    if (isActivelyRecording && activeTab === 'home') {
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
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        );
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
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
          <NewSidebar activeTab={activeTab} onTabChange={setActiveTab} />
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
    </div>
  );
}
