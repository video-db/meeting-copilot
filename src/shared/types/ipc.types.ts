import type { CaptureConfig, Channel } from '../schemas/capture.schema';

export interface StartRecordingParams {
  config: CaptureConfig;
  sessionToken: string;
  accessToken: string;
  apiUrl?: string;
  enableTranscription?: boolean;
}

export interface RecorderEvent {
  event:
    | 'recording:started'
    | 'recording:stopped'
    | 'recording:error'
    | 'transcript'
    | 'upload:progress'
    | 'upload:complete'
    | 'error';
  data?: unknown;
}

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  source: 'mic' | 'system_audio';
  start: number; // epoch seconds from WebSocket
  end: number;   // epoch seconds from WebSocket
}

export interface UploadProgressEvent {
  progress: number;
  total: number;
}

export interface PermissionStatus {
  microphone: boolean;
  screen: boolean;
  accessibility: boolean;
}

export interface StartRecordingResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  // WebSocket connection IDs for real-time transcription (like Python meeting-copilot)
  micWsConnectionId?: string;
  sysAudioWsConnectionId?: string;
}

export interface StopRecordingResult {
  success: boolean;
  error?: string;
}

// Copilot types
export interface CopilotTranscriptSegment {
  id: string;
  recordingId: number;
  sessionId: string;
  channel: 'me' | 'them';
  text: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface CopilotMetrics {
  talkRatio: { me: number; them: number };
  pace: number;
  questionsAsked: number;
  monologueDetected: boolean;
  longestMonologue: number;
  totalDuration: number;
  callDuration: number;
  wordCount: { me: number; them: number };
  segmentCount: { me: number; them: number };
}

export interface CopilotSentiment {
  current: 'positive' | 'neutral' | 'negative';
  trend: 'improving' | 'stable' | 'declining';
  averageScore: number;
  history: Array<{ time: number; sentiment: string; text: string }>;
}

export interface CopilotNudge {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  dismissible: boolean;
  timestamp: number;
  actionLabel?: string;
  actionType?: string;
}

export interface CopilotCueCard {
  triggerId: string;
  id: string;
  objectionType: string;
  title: string;
  talkTracks: string[];
  followUpQuestions: string[];
  proofPoints?: string[];
  avoidSaying?: string[];
  triggerText: string;
  segmentId: string;
  timestamp: number;
  status: 'active' | 'pinned' | 'dismissed';
  confidence: number;
}

export interface CopilotPlaybookItem {
  id: string;
  label: string;
  description: string;
  status: 'missing' | 'partial' | 'covered';
  keywords: string[];
  suggestedQuestions: string[];
  evidence: Array<{ segmentId: string; timestamp: number; excerpt: string; confidence: number }>;
}

export interface CopilotPlaybookSnapshot {
  playbookId: string;
  playbookName: string;
  covered: number;
  partial: number;
  missing: number;
  total: number;
  coveragePercentage: number;
  items: CopilotPlaybookItem[];
  recommendations: string[];
}

export interface CopilotCallSummary {
  bullets: string[];
  customerPain: string[];
  customerGoals: string[];
  objections: Array<{ type: string; text: string; response?: string; resolved: boolean; timestamp: number }>;
  commitments: Array<{ who: 'me' | 'them'; commitment: string; timestamp: number }>;
  nextSteps: Array<{ action: string; owner: 'me' | 'them' | 'both'; priority: string; deadline?: string }>;
  keyDecisions: string[];
  riskFlags: string[];
  generatedAt: number;
}

export interface CopilotConfig {
  enableTranscription: boolean;
  enableMetrics: boolean;
  enableSentiment: boolean;
  enableNudges: boolean;
  enableCueCards: boolean;
  enablePlaybook: boolean;
  playbookId?: string;
  useLLMForDetection: boolean;
}

export interface IpcApi {
  capture: {
    startRecording: (params: StartRecordingParams) => Promise<StartRecordingResult>;
    stopRecording: () => Promise<StopRecordingResult>;
    pauseTracks: (tracks: string[]) => Promise<void>;
    resumeTracks: (tracks: string[]) => Promise<void>;
    listChannels: (sessionToken: string, apiUrl?: string) => Promise<Channel[]>;
  };
  permissions: {
    checkMicPermission: () => Promise<boolean>;
    checkScreenPermission: () => Promise<boolean>;
    checkAccessibilityPermission: () => Promise<boolean>;
    requestMicPermission: () => Promise<boolean>;
    requestScreenPermission: () => Promise<boolean>;
    openSystemSettings: (pane: string) => Promise<void>;
    getStatus: () => Promise<PermissionStatus>;
  };
  app: {
    getSettings: () => Promise<{
      accessToken?: string;
      userName?: string;
      apiKey?: string;
      apiUrl?: string;
      webhookUrl?: string;
    }>;
    getServerPort: () => Promise<number>;
    logout: () => Promise<void>;
    openExternalLink: (url: string) => Promise<void>;
    showNotification: (title: string, body: string) => Promise<void>;
    openPlayerWindow: (url: string) => Promise<void>;
  };
  on: {
    recorderEvent: (callback: (event: RecorderEvent) => void) => () => void;
    authRequired: (callback: () => void) => () => void;
  };
  copilot: {
    initialize: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
    startCall: (recordingId: number, sessionId: string) => Promise<{ success: boolean; error?: string }>;
    endCall: () => Promise<{ success: boolean; summary?: CopilotCallSummary; error?: string }>;
    sendTranscript: (channel: 'me' | 'them', data: { text: string; is_final: boolean; start: number; end: number }) => Promise<{ success: boolean; error?: string }>;
    updateConfig: (config: Partial<CopilotConfig>) => Promise<{ success: boolean; error?: string }>;
    getState: () => Promise<{ success: boolean; data?: any; error?: string }>;
    dismissCueCard: (triggerId: string) => Promise<{ success: boolean; error?: string }>;
    pinCueCard: (triggerId: string) => Promise<{ success: boolean; error?: string }>;
    cueCardFeedback: (triggerId: string, feedback: 'helpful' | 'wrong' | 'irrelevant') => Promise<{ success: boolean; error?: string }>;
    dismissNudge: (nudgeId: string) => Promise<{ success: boolean; error?: string }>;
    getPlaybooks: () => Promise<{ success: boolean; playbooks?: any[]; error?: string }>;
    getCueCards: () => Promise<{ success: boolean; cueCards?: any[]; error?: string }>;
    createBookmark: (data: { recordingId: number; timestamp: number; category: string; note?: string }) => Promise<{ success: boolean; bookmark?: any; error?: string }>;
    getBookmarks: (recordingId: number) => Promise<{ success: boolean; bookmarks?: any[]; error?: string }>;
  };
  copilotOn: {
    onTranscript: (callback: (segment: CopilotTranscriptSegment) => void) => () => void;
    onMetrics: (callback: (data: { metrics: CopilotMetrics; health: number }) => void) => () => void;
    onSentiment: (callback: (data: { sentiment: CopilotSentiment }) => void) => () => void;
    onNudge: (callback: (data: { nudge: CopilotNudge }) => void) => () => void;
    onCueCard: (callback: (data: { cueCard: CopilotCueCard }) => void) => () => void;
    onPlaybook: (callback: (data: { item: CopilotPlaybookItem; snapshot: CopilotPlaybookSnapshot }) => void) => () => void;
    onCallEnded: (callback: (data: { summary: CopilotCallSummary; playbook?: CopilotPlaybookSnapshot; metrics: CopilotMetrics; duration: number }) => void) => () => void;
    onError: (callback: (data: { error: string; context?: string }) => void) => () => void;
  };
  mcp: {
    getServers: () => Promise<{ success: boolean; servers?: any[]; connectionStates?: Record<string, any>; error?: string }>;
    getServer: (serverId: string) => Promise<{ success: boolean; server?: any; error?: string }>;
    createServer: (request: any) => Promise<{ success: boolean; server?: any; error?: string }>;
    updateServer: (serverId: string, request: any) => Promise<{ success: boolean; server?: any; error?: string }>;
    deleteServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
    connect: (serverId: string) => Promise<{ success: boolean; tools?: any[]; error?: string }>;
    disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
    testConnection: (serverId: string) => Promise<{ success: boolean; result?: any; error?: string }>;
    getTools: () => Promise<{ success: boolean; tools?: any[]; error?: string }>;
    executeTool: (serverId: string, toolName: string, input?: Record<string, unknown>) => Promise<{ success: boolean; result?: any; error?: string }>;
    getTemplates: () => Promise<{ success: boolean; templates?: any[]; error?: string }>;
    getTemplate: (templateId: string) => Promise<{ success: boolean; template?: any; error?: string }>;
    getToolCalls: (recordingId: number) => Promise<{ success: boolean; calls?: any[]; error?: string }>;
    dismissResult: (resultId: string) => Promise<{ success: boolean; error?: string }>;
    pinResult: (resultId: string) => Promise<{ success: boolean; error?: string }>;
  };
  mcpOn: {
    onResult: (callback: (data: { result: any }) => void) => () => void;
    onError: (callback: (data: { serverId: string; toolName: string; error: string }) => void) => () => void;
    onServerConnected: (callback: (data: { serverId: string; tools: any[] }) => void) => () => void;
    onServerDisconnected: (callback: (data: { serverId: string; reason: string }) => void) => () => void;
    onServerError: (callback: (data: { serverId: string; error: string }) => void) => () => void;
  };
}

export type IpcChannel =
  | 'recorder-start-recording'
  | 'recorder-stop-recording'
  | 'recorder-pause-tracks'
  | 'recorder-resume-tracks'
  | 'recorder-list-channels'
  | 'check-mic-permission'
  | 'check-screen-permission'
  | 'check-accessibility-permission'
  | 'request-mic-permission'
  | 'request-screen-permission'
  | 'open-system-settings'
  | 'get-permission-status'
  | 'get-settings'
  | 'logout'
  | 'open-external-link'
  | 'show-notification'
  | 'open-player-window'
  | 'recorder-event'
  | 'auth-required';
