import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { AuthView } from './components/auth/AuthView';
import { StreamToggles } from './components/recording/StreamToggles';
import { TopStatusBar } from './components/recording/TopStatusBar';
import { TranscriptionPanel } from './components/transcription/TranscriptionPanel';
import { HistoryView } from './components/history/HistoryView';
import { useConfigStore } from './stores/config.store';
import { useSession } from './hooks/useSession';
import { useSessionStore } from './stores/session.store';
import { usePermissions } from './hooks/usePermissions';
import { useGlobalRecorderEvents } from './hooks/useGlobalRecorderEvents';
import { useCopilot } from './hooks/useCopilot';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { ErrorToast } from './components/ui/error-toast';
import { AlertCircle, Shield, BookOpen, X, Mic, Users, Gauge, Loader2 } from 'lucide-react';
import {
  CueCardOverlay,
  PlaybookPanel,
  NudgeToast,
  SentimentIndicator,
  CallSummaryView,
} from './components/copilot';
import { MCPResultsOverlay } from './components/mcp';
import { useCopilotStore } from './stores/copilot.store';
import { CueCardEditor } from './components/settings/CueCardEditor';
import { PlaybookEditor } from './components/settings/PlaybookEditor';
import { PromptsEditor } from './components/settings/PromptsEditor';
import { MCPServersPanel } from './components/settings/MCPServersPanel';
import { cn } from './lib/utils';

type Tab = 'recording' | 'history' | 'settings';

function PermissionsView() {
  const { status, requestMicPermission, openSettings } = usePermissions();

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Permissions Required</CardTitle>
          </div>
          <CardDescription>
            Meeting Copilot needs access to record your screen and microphone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Microphone</p>
              <p className="text-xs text-muted-foreground">Required for voice recording</p>
            </div>
            {status.microphone ? (
              <span className="text-xs text-green-600 font-medium">Granted</span>
            ) : (
              <Button size="sm" onClick={requestMicPermission}>
                Grant
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Screen Recording</p>
              <p className="text-xs text-muted-foreground">Required for screen capture</p>
            </div>
            {status.screen ? (
              <span className="text-xs text-green-600 font-medium">Granted</span>
            ) : (
              <Button size="sm" onClick={() => openSettings('screen')}>
                Open Settings
              </Button>
            )}
          </div>

          {!status.screen && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Screen Recording permission must be granted in System Preferences. Click "Open
                Settings" and enable Meeting Copilot in the list.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlaybookModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-8"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-2xl max-h-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="border-b flex flex-row items-center justify-between shrink-0">
          <div>
            <CardTitle>Playbook Progress</CardTitle>
            <CardDescription>Track your discovery progress</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 flex-1 overflow-hidden min-h-0">
          <PlaybookPanel className="h-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricsSidebar() {
  const { metrics, healthScore, isCallActive } = useCopilotStore();

  if (!isCallActive || !metrics) {
    return null;
  }

  const mePercent = Math.round(metrics.talkRatio.me * 100);
  const themPercent = Math.round(metrics.talkRatio.them * 100);

  const getHealthColor = () => {
    if (healthScore >= 80) return 'text-green-500';
    if (healthScore >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getHealthLabel = () => {
    if (healthScore >= 80) return 'Great';
    if (healthScore >= 60) return 'Good';
    if (healthScore >= 40) return 'Fair';
    return 'Needs Work';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Conversation Metrics
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {Math.floor(metrics.callDuration / 60)}:{String(Math.floor(metrics.callDuration % 60)).padStart(2, '0')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-muted/50 to-muted rounded-lg">
          <div>
            <p className="text-sm font-medium">Conversation Health</p>
            <p className="text-xs text-muted-foreground">{getHealthLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('text-3xl font-bold', getHealthColor())}>{healthScore}</div>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Talk Ratio */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Talk Ratio</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                You: {mePercent}%
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Them: {themPercent}%
              </span>
            </div>
            <div className="h-3 flex rounded-full overflow-hidden bg-muted">
              <div
                className={cn(
                  'transition-all duration-500',
                  mePercent > 65 ? 'bg-amber-500' : mePercent >= 35 ? 'bg-green-500' : 'bg-blue-500'
                )}
                style={{ width: `${mePercent}%` }}
              />
              <div className="bg-slate-400 transition-all duration-500" style={{ width: `${themPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Speaking Pace */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Speaking Pace</span>
          </div>
          <span className={cn('text-lg font-semibold', metrics.pace > 180 ? 'text-amber-500' : '')}>
            {metrics.pace} WPM
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordingView() {
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const { isCallActive, callSummary, playbook } = useCopilotStore();
  const { status, streams, toggleStream, isStarting, isStopping } = useSession();

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'stopping';

  useCopilot();

  // Show call summary view if call ended and summary available
  if (callSummary && !isCallActive) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopStatusBar />
        <div className="flex-1 overflow-hidden p-6">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-semibold">Call Complete</h2>
              <Button variant="outline" size="sm" onClick={() => useCopilotStore.getState().reset()}>
                Start New Call
              </Button>
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
      <div className="flex flex-col h-full overflow-hidden">
        <TopStatusBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Generating Call Summary</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Analyzing your conversation and preparing insights...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Top Status Bar */}
      <TopStatusBar />

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Column - Transcription */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Stream Toggles (only show when not recording) */}
          {!isRecording && (
            <Card className="shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recording Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <StreamToggles
                  streams={streams}
                  onToggle={toggleStream}
                  disabled={isStarting || isStopping}
                />
              </CardContent>
            </Card>
          )}

          {/* Transcription Panel */}
          <div className="flex-1 min-h-0">
            <TranscriptionPanel />
          </div>
        </div>

        {/* Right Column - Assistance + Metrics */}
        <div className="w-96 flex flex-col gap-4 shrink-0 overflow-hidden">
          {/* Scrollable container for right panel */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* MCP Results Overlay - Shows tool call results */}
            <MCPResultsOverlay />

            {/* Cue Card Overlay */}
            <CueCardOverlay />

            {/* Sentiment Indicator */}
            <SentimentIndicator />

            {/* Metrics Sidebar */}
            <MetricsSidebar />
          </div>
        </div>
      </div>

      {/* Floating Playbook Button */}
      {isCallActive && playbook && (
        <button
          onClick={() => setShowPlaybookModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center text-white z-40"
          title="View Playbook Progress"
        >
          <BookOpen className="w-6 h-6" />
          {playbook.coveragePercentage < 70 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
              {playbook.missing}
            </span>
          )}
        </button>
      )}

      {/* Playbook Modal */}
      <PlaybookModal isOpen={showPlaybookModal} onClose={() => setShowPlaybookModal(false)} />
    </div>
  );
}

function SettingsView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'account' | 'cueCards' | 'playbooks' | 'prompts' | 'mcpServers'
  >('account');
  const configStore = useConfigStore();

  const settingsTabs = [
    { id: 'account' as const, label: 'Account' },
    { id: 'cueCards' as const, label: 'Cue Cards' },
    { id: 'playbooks' as const, label: 'Playbooks' },
    { id: 'prompts' as const, label: 'AI Settings' },
    { id: 'mcpServers' as const, label: 'MCP Servers' },
  ];

  return (
    <div className="space-y-4 h-full overflow-auto">
      {/* Settings Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {settingsTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeSettingsTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveSettingsTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl">
        {activeSettingsTab === 'account' && (
          <div className="max-w-md space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{configStore.userName || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">API Key</p>
                  <p className="font-mono text-xs">
                    {configStore.apiKey ? `${configStore.apiKey.slice(0, 8)}...` : 'Not set'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Meeting Copilot is a desktop app for recording meetings with real-time
                  transcription and AI-powered insights.
                </p>
                <p className="text-xs text-muted-foreground">
                  Built with Electron, React, and VideoDB.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSettingsTab === 'cueCards' && <CueCardEditor />}
        {activeSettingsTab === 'playbooks' && <PlaybookEditor />}
        {activeSettingsTab === 'prompts' && <PromptsEditor />}
        {activeSettingsTab === 'mcpServers' && <MCPServersPanel />}
      </div>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recording');

  const configStore = useConfigStore();
  const sessionStore = useSessionStore();
  const { allGranted, loading: permissionsLoading } = usePermissions();

  // Global listener for recorder events - persists during navigation
  useGlobalRecorderEvents();

  const isAuthenticated = configStore.isAuthenticated();

  // Handle clearing session errors
  const handleDismissError = () => {
    sessionStore.setError(null);
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'recording':
        return 'Recording';
      case 'history':
        return 'History';
      case 'settings':
        return 'Settings';
    }
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return <AuthView />;
    }

    if (permissionsLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      );
    }

    if (!allGranted && activeTab === 'recording') {
      return <PermissionsView />;
    }

    switch (activeTab) {
      case 'recording':
        return <RecordingView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
    }
  };

  // Special layout for recording view - no MainContent header
  if (isAuthenticated && activeTab === 'recording' && allGranted && !permissionsLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Shared titlebar for macOS traffic lights */}
        <div className="h-12 flex items-center justify-center border-b bg-background/80 backdrop-blur-lg shrink-0 drag-region relative">
          {/* Space for traffic lights (absolute so title can center) */}
          <div className="absolute left-0 w-20 shrink-0" />
          <span className="text-sm font-medium text-muted-foreground">Meeting Copilot</span>
        </div>

        {/* Main layout below titlebar */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 overflow-hidden">
            <RecordingView />
          </div>
        </div>

        {/* Global Copilot Components */}
        <NudgeToast position="bottom" />
        <ErrorToast
          message={sessionStore.error}
          onDismiss={handleDismissError}
          position="bottom"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Shared titlebar for macOS traffic lights */}
      <div className="h-12 flex items-center justify-center border-b bg-background/80 backdrop-blur-lg shrink-0 drag-region relative">
        {/* Space for traffic lights (absolute so title can center) */}
        <div className="absolute left-0 w-20 shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">Meeting Copilot</span>
      </div>

      {/* Main layout below titlebar */}
      <div className="flex flex-1 overflow-hidden">
        {isAuthenticated && <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />}
        <MainContent title={getTitle()}>{renderContent()}</MainContent>
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
