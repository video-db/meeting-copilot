import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi, RecorderEvent, PermissionStatus, StartRecordingParams } from '../shared/types/ipc.types';
import type { Channel } from '../shared/schemas/capture.schema';

// Copilot event types
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

export interface CopilotApi {
  initialize: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  startCall: (recordingId: number, sessionId: string) => Promise<{ success: boolean; error?: string }>;
  endCall: () => Promise<{ success: boolean; summary?: CopilotCallSummary; error?: string }>;
  sendTranscript: (channel: 'me' | 'them', data: { text: string; is_final: boolean; start: number; end: number }) => Promise<{ success: boolean; error?: string }>;
  updateConfig: (config: Partial<{
    enableTranscription: boolean;
    enableMetrics: boolean;
    enableSentiment: boolean;
    enableNudges: boolean;
    enableCueCards: boolean;
    enablePlaybook: boolean;
    playbookId?: string;
    useLLMForDetection: boolean;
  }>) => Promise<{ success: boolean; error?: string }>;
  getState: () => Promise<{
    success: boolean;
    data?: {
      state: { recordingId: number; sessionId: string; startTime: number; isActive: boolean } | null;
      metrics: CopilotMetrics | null;
      sentiment: CopilotSentiment | null;
      playbook: CopilotPlaybookSnapshot | null;
      isActive: boolean;
    };
    error?: string;
  }>;
  dismissCueCard: (triggerId: string) => Promise<{ success: boolean; error?: string }>;
  pinCueCard: (triggerId: string) => Promise<{ success: boolean; error?: string }>;
  cueCardFeedback: (triggerId: string, feedback: 'helpful' | 'wrong' | 'irrelevant') => Promise<{ success: boolean; error?: string }>;
  dismissNudge: (nudgeId: string) => Promise<{ success: boolean; error?: string }>;
  getPlaybooks: () => Promise<{ success: boolean; playbooks?: any[]; error?: string }>;
  getCueCards: () => Promise<{ success: boolean; cueCards?: any[]; error?: string }>;
  createBookmark: (data: { recordingId: number; timestamp: number; category: string; note?: string }) => Promise<{ success: boolean; bookmark?: any; error?: string }>;
  getBookmarks: (recordingId: number) => Promise<{ success: boolean; bookmarks?: any[]; error?: string }>;
}

export interface CopilotEvents {
  onTranscript: (callback: (segment: CopilotTranscriptSegment) => void) => () => void;
  onMetrics: (callback: (data: { metrics: CopilotMetrics; health: number }) => void) => () => void;
  onSentiment: (callback: (data: { sentiment: CopilotSentiment }) => void) => () => void;
  onNudge: (callback: (data: { nudge: CopilotNudge }) => void) => () => void;
  onCueCard: (callback: (data: { cueCard: CopilotCueCard }) => void) => () => void;
  onPlaybook: (callback: (data: { item: CopilotPlaybookItem; snapshot: CopilotPlaybookSnapshot }) => void) => () => void;
  onCallEnded: (callback: (data: { summary: CopilotCallSummary; playbook?: CopilotPlaybookSnapshot; metrics: CopilotMetrics; duration: number }) => void) => () => void;
  onError: (callback: (data: { error: string; context?: string }) => void) => () => void;
}

// MCP Types
export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  templateId?: string;
  isEnabled: boolean;
  autoConnect: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string | null;
  lastConnectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: object;
  serverId: string;
  serverName: string;
}

export interface MCPDisplayResult {
  id: string;
  toolCallId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  displayType: 'cue-card' | 'panel' | 'modal' | 'toast';
  title: string;
  content: {
    text?: string;
    markdown?: string;
    items?: Array<{ label: string; value: string; type?: string }>;
    properties?: Record<string, string | number | boolean>;
    raw?: unknown;
  };
  timestamp: string;
  dismissed?: boolean;
  pinned?: boolean;
}

export interface MCPServerTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  transport: 'stdio' | 'http';
  defaultCommand?: string;
  defaultArgs?: string[];
  defaultUrl?: string;
  requiredEnvVars?: Array<{ key: string; label: string; description?: string; placeholder?: string; secret?: boolean }>;
  requiredHeaders?: Array<{ key: string; label: string; description?: string; placeholder?: string; secret?: boolean }>;
  docsUrl?: string;
  setupInstructions?: string;
}

export interface MCPApi {
  // Server management
  getServers: () => Promise<{ success: boolean; servers?: MCPServerConfig[]; connectionStates?: Record<string, { status: string; error?: string }>; error?: string }>;
  getServer: (serverId: string) => Promise<{ success: boolean; server?: MCPServerConfig; error?: string }>;
  createServer: (request: {
    name: string;
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    templateId?: string;
    isEnabled?: boolean;
    autoConnect?: boolean;
  }) => Promise<{ success: boolean; server?: MCPServerConfig; error?: string }>;
  updateServer: (serverId: string, request: {
    name?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    isEnabled?: boolean;
    autoConnect?: boolean;
  }) => Promise<{ success: boolean; server?: MCPServerConfig; error?: string }>;
  deleteServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;

  // Connection management
  connect: (serverId: string) => Promise<{ success: boolean; tools?: MCPTool[]; error?: string }>;
  disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  testConnection: (serverId: string) => Promise<{ success: boolean; result?: { success: boolean; tools?: MCPTool[]; latencyMs?: number; error?: string }; error?: string }>;

  // Tools
  getTools: () => Promise<{ success: boolean; tools?: MCPTool[]; error?: string }>;
  executeTool: (serverId: string, toolName: string, input?: Record<string, unknown>) => Promise<{ success: boolean; result?: MCPDisplayResult; error?: string }>;

  // Templates
  getTemplates: () => Promise<{ success: boolean; templates?: MCPServerTemplate[]; error?: string }>;
  getTemplate: (templateId: string) => Promise<{ success: boolean; template?: MCPServerTemplate; error?: string }>;

  // History
  getToolCalls: (recordingId: number) => Promise<{ success: boolean; calls?: any[]; error?: string }>;

  // Results
  dismissResult: (resultId: string) => Promise<{ success: boolean; error?: string }>;
  pinResult: (resultId: string) => Promise<{ success: boolean; error?: string }>;

  // Trigger Keywords
  getTriggerKeywords: () => Promise<{ success: boolean; keywords: string[]; error?: string }>;
  setTriggerKeywords: (keywords: string[]) => Promise<{ success: boolean; error?: string }>;
}

export interface MCPEvents {
  onResult: (callback: (data: { result: MCPDisplayResult }) => void) => () => void;
  onError: (callback: (data: { serverId: string; toolName: string; error: string }) => void) => () => void;
  onServerConnected: (callback: (data: { serverId: string; tools: MCPTool[] }) => void) => () => void;
  onServerDisconnected: (callback: (data: { serverId: string; reason: string }) => void) => () => void;
  onServerError: (callback: (data: { serverId: string; error: string }) => void) => () => void;
}

const api: IpcApi = {
  capture: {
    startRecording: (params: StartRecordingParams) =>
      ipcRenderer.invoke('recorder-start-recording', params),
    stopRecording: () => ipcRenderer.invoke('recorder-stop-recording'),
    pauseTracks: (tracks: string[]) => ipcRenderer.invoke('recorder-pause-tracks', tracks),
    resumeTracks: (tracks: string[]) => ipcRenderer.invoke('recorder-resume-tracks', tracks),
    listChannels: (sessionToken: string, apiUrl?: string) =>
      ipcRenderer.invoke('recorder-list-channels', sessionToken, apiUrl),
  },

  permissions: {
    checkMicPermission: () => ipcRenderer.invoke('check-mic-permission'),
    checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),
    checkAccessibilityPermission: () => ipcRenderer.invoke('check-accessibility-permission'),
    requestMicPermission: () => ipcRenderer.invoke('request-mic-permission'),
    requestScreenPermission: () => ipcRenderer.invoke('request-screen-permission'),
    openSystemSettings: (pane: string) => ipcRenderer.invoke('open-system-settings', pane),
    getStatus: (): Promise<PermissionStatus> => ipcRenderer.invoke('get-permission-status'),
  },

  app: {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    getServerPort: () => ipcRenderer.invoke('get-server-port'),
    logout: () => ipcRenderer.invoke('logout'),
    openExternalLink: (url: string) => ipcRenderer.invoke('open-external-link', url),
    showNotification: (title: string, body: string) =>
      ipcRenderer.invoke('show-notification', title, body),
    openPlayerWindow: (url: string) => ipcRenderer.invoke('open-player-window', url),
  },

  on: {
    recorderEvent: (callback: (event: RecorderEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: RecorderEvent) => {
        callback(data);
      };
      ipcRenderer.on('recorder-event', listener);
      return () => {
        ipcRenderer.removeListener('recorder-event', listener);
      };
    },

    authRequired: (callback: () => void) => {
      const listener = () => {
        callback();
      };
      ipcRenderer.on('auth-required', listener);
      return () => {
        ipcRenderer.removeListener('auth-required', listener);
      };
    },
  },

  // Meeting Co-Pilot API
  copilot: {
    initialize: (apiKey: string) => ipcRenderer.invoke('copilot:initialize', apiKey),
    startCall: (recordingId: number, sessionId: string) => ipcRenderer.invoke('copilot:start-call', recordingId, sessionId),
    endCall: () => ipcRenderer.invoke('copilot:end-call'),
    sendTranscript: (channel: 'me' | 'them', data: { text: string; is_final: boolean; start: number; end: number }) =>
      ipcRenderer.invoke('copilot:transcript', channel, data),
    updateConfig: (config: any) => ipcRenderer.invoke('copilot:update-config', config),
    getState: () => ipcRenderer.invoke('copilot:get-state'),
    dismissCueCard: (triggerId: string) => ipcRenderer.invoke('copilot:dismiss-cue-card', triggerId),
    pinCueCard: (triggerId: string) => ipcRenderer.invoke('copilot:pin-cue-card', triggerId),
    cueCardFeedback: (triggerId: string, feedback: 'helpful' | 'wrong' | 'irrelevant') =>
      ipcRenderer.invoke('copilot:cue-card-feedback', triggerId, feedback),
    dismissNudge: (nudgeId: string) => ipcRenderer.invoke('copilot:dismiss-nudge', nudgeId),
    getPlaybooks: () => ipcRenderer.invoke('copilot:get-playbooks'),
    getCueCards: () => ipcRenderer.invoke('copilot:get-cue-cards'),
    createBookmark: (data: { recordingId: number; timestamp: number; category: string; note?: string }) =>
      ipcRenderer.invoke('copilot:create-bookmark', data),
    getBookmarks: (recordingId: number) => ipcRenderer.invoke('copilot:get-bookmarks', recordingId),
  } as CopilotApi,

  // Copilot event listeners
  copilotOn: {
    onTranscript: (callback: (segment: CopilotTranscriptSegment) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: CopilotTranscriptSegment) => callback(data);
      ipcRenderer.on('copilot:transcript', listener);
      return () => ipcRenderer.removeListener('copilot:transcript', listener);
    },
    onMetrics: (callback: (data: { metrics: CopilotMetrics; health: number }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:metrics', listener);
      return () => ipcRenderer.removeListener('copilot:metrics', listener);
    },
    onSentiment: (callback: (data: { sentiment: CopilotSentiment }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:sentiment', listener);
      return () => ipcRenderer.removeListener('copilot:sentiment', listener);
    },
    onNudge: (callback: (data: { nudge: CopilotNudge }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:nudge', listener);
      return () => ipcRenderer.removeListener('copilot:nudge', listener);
    },
    onCueCard: (callback: (data: { cueCard: CopilotCueCard }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:cue-card', listener);
      return () => ipcRenderer.removeListener('copilot:cue-card', listener);
    },
    onPlaybook: (callback: (data: { item: CopilotPlaybookItem; snapshot: CopilotPlaybookSnapshot }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:playbook', listener);
      return () => ipcRenderer.removeListener('copilot:playbook', listener);
    },
    onCallEnded: (callback: (data: { summary: CopilotCallSummary; playbook?: CopilotPlaybookSnapshot; metrics: CopilotMetrics; duration: number }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:call-ended', listener);
      return () => ipcRenderer.removeListener('copilot:call-ended', listener);
    },
    onError: (callback: (data: { error: string; context?: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('copilot:error', listener);
      return () => ipcRenderer.removeListener('copilot:error', listener);
    },
  } as CopilotEvents,

  // MCP API
  mcp: {
    // Server management
    getServers: () => ipcRenderer.invoke('mcp:get-servers'),
    getServer: (serverId: string) => ipcRenderer.invoke('mcp:get-server', serverId),
    createServer: (request: any) => ipcRenderer.invoke('mcp:create-server', request),
    updateServer: (serverId: string, request: any) => ipcRenderer.invoke('mcp:update-server', serverId, request),
    deleteServer: (serverId: string) => ipcRenderer.invoke('mcp:delete-server', serverId),

    // Connection management
    connect: (serverId: string) => ipcRenderer.invoke('mcp:connect', serverId),
    disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
    testConnection: (serverId: string) => ipcRenderer.invoke('mcp:test-connection', serverId),

    // Tools
    getTools: () => ipcRenderer.invoke('mcp:get-tools'),
    executeTool: (serverId: string, toolName: string, input?: Record<string, unknown>) =>
      ipcRenderer.invoke('mcp:execute-tool', serverId, toolName, input),

    // Templates
    getTemplates: () => ipcRenderer.invoke('mcp:get-templates'),
    getTemplate: (templateId: string) => ipcRenderer.invoke('mcp:get-template', templateId),

    // History
    getToolCalls: (recordingId: number) => ipcRenderer.invoke('mcp:get-tool-calls', recordingId),

    // Results
    dismissResult: (resultId: string) => ipcRenderer.invoke('mcp:dismiss-result', resultId),
    pinResult: (resultId: string) => ipcRenderer.invoke('mcp:pin-result', resultId),

    // Trigger Keywords
    getTriggerKeywords: () => ipcRenderer.invoke('mcp:get-trigger-keywords'),
    setTriggerKeywords: (keywords: string[]) => ipcRenderer.invoke('mcp:set-trigger-keywords', keywords),
  } as MCPApi,

  // MCP event listeners
  mcpOn: {
    onResult: (callback: (data: { result: MCPDisplayResult }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('mcp:result', listener);
      return () => ipcRenderer.removeListener('mcp:result', listener);
    },
    onError: (callback: (data: { serverId: string; toolName: string; error: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('mcp:error', listener);
      return () => ipcRenderer.removeListener('mcp:error', listener);
    },
    onServerConnected: (callback: (data: { serverId: string; tools: MCPTool[] }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('mcp:server-connected', listener);
      return () => ipcRenderer.removeListener('mcp:server-connected', listener);
    },
    onServerDisconnected: (callback: (data: { serverId: string; reason: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('mcp:server-disconnected', listener);
      return () => ipcRenderer.removeListener('mcp:server-disconnected', listener);
    },
    onServerError: (callback: (data: { serverId: string; error: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('mcp:server-error', listener);
      return () => ipcRenderer.removeListener('mcp:server-error', listener);
    },
  } as MCPEvents,
};

contextBridge.exposeInMainWorld('electronAPI', api);

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: IpcApi & {
      copilot: CopilotApi;
      copilotOn: CopilotEvents;
      mcp: MCPApi;
      mcpOn: MCPEvents;
    };
  }
}
