/**
 * MCP Store
 *
 * Centralized state management for MCP (Model Context Protocol) features:
 * - Server configurations
 * - Connection states
 * - Available tools
 * - Active results
 * - Templates
 */

import { create } from 'zustand';
import type {
  MCPServerConfig,
  MCPTool,
  MCPDisplayResult,
  MCPServerTemplate,
} from '../../preload/index';

// Types

export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPState {
  // Server management
  servers: MCPServerConfig[];
  templates: MCPServerTemplate[];

  // Connection state
  connectionStates: Record<string, { status: MCPConnectionStatus; error?: string }>;

  // Available tools (aggregated from all connected servers)
  availableTools: MCPTool[];

  // Active results to display
  activeResults: MCPDisplayResult[];

  // Pending tool calls
  pendingCalls: Set<string>;

  // Configuration
  isInitialized: boolean;
  autoTriggerEnabled: boolean;

  // Custom trigger keywords for MCP agent
  customTriggerKeywords: string[];

  // Error state
  lastError?: string;

  // Actions
  setInitialized: (value: boolean) => void;
  setAutoTriggerEnabled: (value: boolean) => void;
  setCustomTriggerKeywords: (keywords: string[]) => void;

  // Server actions
  setServers: (servers: MCPServerConfig[]) => void;
  addServer: (server: MCPServerConfig) => void;
  updateServer: (serverId: string, updates: Partial<MCPServerConfig>) => void;
  removeServer: (serverId: string) => void;

  // Template actions
  setTemplates: (templates: MCPServerTemplate[]) => void;

  // Connection state actions
  setConnectionStates: (states: Record<string, { status: MCPConnectionStatus; error?: string }>) => void;
  updateConnectionState: (serverId: string, status: MCPConnectionStatus, error?: string) => void;

  // Tool actions
  setAvailableTools: (tools: MCPTool[]) => void;
  addToolsFromServer: (serverId: string, tools: MCPTool[]) => void;
  removeToolsFromServer: (serverId: string) => void;

  // Result actions
  addResult: (result: MCPDisplayResult) => void;
  dismissResult: (resultId: string) => void;
  pinResult: (resultId: string) => void;
  clearResults: () => void;

  // Pending calls actions
  addPendingCall: (callId: string) => void;
  removePendingCall: (callId: string) => void;

  // Error actions
  setError: (error: string | undefined) => void;

  // Reset
  reset: () => void;
}

// Initial State

const initialState = {
  servers: [] as MCPServerConfig[],
  templates: [] as MCPServerTemplate[],
  connectionStates: {} as Record<string, { status: MCPConnectionStatus; error?: string }>,
  availableTools: [] as MCPTool[],
  activeResults: [] as MCPDisplayResult[],
  pendingCalls: new Set<string>(),
  isInitialized: false,
  autoTriggerEnabled: true,
  customTriggerKeywords: [] as string[],
  lastError: undefined,
};

// Store

export const useMCPStore = create<MCPState>((set, get) => ({
  ...initialState,

  // Initialization
  setInitialized: (value) => set({ isInitialized: value }),
  setAutoTriggerEnabled: (value) => set({ autoTriggerEnabled: value }),
  setCustomTriggerKeywords: (keywords) => set({ customTriggerKeywords: keywords }),

  // Server management
  setServers: (servers) => set({ servers }),

  addServer: (server) => {
    set((state) => ({
      servers: [...state.servers, server],
    }));
  },

  updateServer: (serverId, updates) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, ...updates } : s
      ),
    }));
  },

  removeServer: (serverId) => {
    const { removeToolsFromServer } = get();
    removeToolsFromServer(serverId);

    set((state) => ({
      servers: state.servers.filter((s) => s.id !== serverId),
      connectionStates: Object.fromEntries(
        Object.entries(state.connectionStates).filter(([id]) => id !== serverId)
      ),
    }));
  },

  // Templates
  setTemplates: (templates) => set({ templates }),

  // Connection states
  setConnectionStates: (states) => set({ connectionStates: states }),

  updateConnectionState: (serverId, status, error) => {
    set((state) => ({
      connectionStates: {
        ...state.connectionStates,
        [serverId]: { status, error },
      },
    }));
  },

  // Tools
  setAvailableTools: (tools) => set({ availableTools: tools }),

  addToolsFromServer: (serverId, tools) => {
    set((state) => {
      // Remove existing tools from this server, then add new ones
      const existingTools = state.availableTools.filter((t) => t.serverId !== serverId);
      return {
        availableTools: [...existingTools, ...tools],
      };
    });
  },

  removeToolsFromServer: (serverId) => {
    set((state) => ({
      availableTools: state.availableTools.filter((t) => t.serverId !== serverId),
    }));
  },

  // Results
  addResult: (result) => {
    set((state) => {
      if (state.activeResults.some((existing) => existing.id === result.id)) {
        return state;
      }
      return {
        activeResults: [...state.activeResults, result],
      };
    });
  },

  dismissResult: (resultId) => {
    set((state) => ({
      activeResults: state.activeResults.map((r) =>
        r.id === resultId ? { ...r, dismissed: true } : r
      ),
    }));
  },

  pinResult: (resultId) => {
    set((state) => ({
      activeResults: state.activeResults.map((r) =>
        r.id === resultId ? { ...r, pinned: true } : r
      ),
    }));
  },

  clearResults: () => {
    set({ activeResults: [] });
  },

  // Pending calls
  addPendingCall: (callId) => {
    set((state) => ({
      pendingCalls: new Set([...state.pendingCalls, callId]),
    }));
  },

  removePendingCall: (callId) => {
    set((state) => {
      const newPending = new Set(state.pendingCalls);
      newPending.delete(callId);
      return { pendingCalls: newPending };
    });
  },

  // Errors
  setError: (error) => set({ lastError: error }),

  // Reset
  reset: () => {
    set({
      ...initialState,
      pendingCalls: new Set(),
    });
  },
}));

// Selectors (for optimized re-renders)

export const selectServers = (state: MCPState) => state.servers;
export const selectTemplates = (state: MCPState) => state.templates;
export const selectConnectionStates = (state: MCPState) => state.connectionStates;
export const selectAvailableTools = (state: MCPState) => state.availableTools;
export const selectActiveResults = (state: MCPState) => state.activeResults;
export const selectVisibleResults = (state: MCPState) =>
  state.activeResults.filter((r) => !r.dismissed);
export const selectPinnedResults = (state: MCPState) =>
  state.activeResults.filter((r) => r.pinned && !r.dismissed);
export const selectPendingCalls = (state: MCPState) => state.pendingCalls;
export const selectIsInitialized = (state: MCPState) => state.isInitialized;
export const selectAutoTriggerEnabled = (state: MCPState) => state.autoTriggerEnabled;
export const selectCustomTriggerKeywords = (state: MCPState) => state.customTriggerKeywords;
export const selectLastError = (state: MCPState) => state.lastError;

// Computed selectors
export const selectConnectedServerCount = (state: MCPState) =>
  Object.values(state.connectionStates).filter((s) => s.status === 'connected').length;

export const selectToolCount = (state: MCPState) => state.availableTools.length;

export const selectServerById = (serverId: string) => (state: MCPState) =>
  state.servers.find((s) => s.id === serverId);

export const selectConnectionStateById = (serverId: string) => (state: MCPState) =>
  state.connectionStates[serverId];

export const selectToolsByServer = (serverId: string) => (state: MCPState) =>
  state.availableTools.filter((t) => t.serverId === serverId);
