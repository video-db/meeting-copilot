/**
 * useMCP Hook
 *
 * Provides integration between the MCP backend and React components.
 * Handles IPC event subscriptions and state synchronization.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useMCPStore } from '../stores/mcp.store';

// Hook

export function useMCP() {
  const {
    servers,
    templates,
    connectionStates,
    availableTools,
    activeResults,
    pendingCalls,
    isInitialized,
    autoTriggerEnabled,
    customTriggerKeywords,
    lastError,
    setInitialized,
    setAutoTriggerEnabled,
    setCustomTriggerKeywords,
    setServers,
    addServer,
    updateServer,
    removeServer,
    setTemplates,
    setConnectionStates,
    updateConnectionState,
    setAvailableTools,
    addToolsFromServer,
    removeToolsFromServer,
    addResult,
    dismissResult,
    pinResult,
    clearResults,
    addPendingCall,
    removePendingCall,
    setError,
    reset,
  } = useMCPStore();

  const unsubscribersRef = useRef<Array<() => void>>([]);

  /**
   * Load servers and templates from backend
   */
  const loadData = useCallback(async () => {
    try {
      // Load servers
      const serversResult = await window.electronAPI.mcp.getServers();
      if (serversResult.success && serversResult.servers) {
        setServers(serversResult.servers);
        if (serversResult.connectionStates) {
          setConnectionStates(serversResult.connectionStates as any);
        }
      }

      // Load templates
      const templatesResult = await window.electronAPI.mcp.getTemplates();
      if (templatesResult.success && templatesResult.templates) {
        setTemplates(templatesResult.templates);
      }

      // Load tools from connected servers
      const toolsResult = await window.electronAPI.mcp.getTools();
      if (toolsResult.success && toolsResult.tools) {
        setAvailableTools(toolsResult.tools);
      }

      // Load custom trigger keywords
      const keywordsResult = await window.electronAPI.mcp.getTriggerKeywords();
      if (keywordsResult.success && keywordsResult.keywords) {
        setCustomTriggerKeywords(keywordsResult.keywords);
      }

      setInitialized(true);
    } catch (error) {
      console.error('Error loading MCP data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load MCP data');
    }
  }, [setServers, setConnectionStates, setTemplates, setAvailableTools, setCustomTriggerKeywords, setInitialized, setError]);

  /**
   * Create a new server
   */
  const createServer = useCallback(async (request: Parameters<typeof window.electronAPI.mcp.createServer>[0]) => {
    try {
      const result = await window.electronAPI.mcp.createServer(request);
      if (result.success && result.server) {
        addServer(result.server);
        return result.server;
      } else {
        setError(result.error || 'Failed to create server');
        return null;
      }
    } catch (error) {
      console.error('Error creating server:', error);
      setError(error instanceof Error ? error.message : 'Failed to create server');
      return null;
    }
  }, [addServer, setError]);

  /**
   * Update an existing server
   */
  const handleUpdateServer = useCallback(async (
    serverId: string,
    request: Parameters<typeof window.electronAPI.mcp.updateServer>[1]
  ) => {
    try {
      const result = await window.electronAPI.mcp.updateServer(serverId, request);
      if (result.success && result.server) {
        updateServer(serverId, result.server);
        return true;
      } else {
        setError(result.error || 'Failed to update server');
        return false;
      }
    } catch (error) {
      console.error('Error updating server:', error);
      setError(error instanceof Error ? error.message : 'Failed to update server');
      return false;
    }
  }, [updateServer, setError]);

  /**
   * Delete a server
   */
  const deleteServer = useCallback(async (serverId: string) => {
    try {
      const result = await window.electronAPI.mcp.deleteServer(serverId);
      if (result.success) {
        removeServer(serverId);
        return true;
      } else {
        setError(result.error || 'Failed to delete server');
        return false;
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete server');
      return false;
    }
  }, [removeServer, setError]);

  /**
   * Connect to a server
   */
  const connect = useCallback(async (serverId: string) => {
    updateConnectionState(serverId, 'connecting');

    try {
      const result = await window.electronAPI.mcp.connect(serverId);
      if (result.success && result.tools) {
        updateConnectionState(serverId, 'connected');
        addToolsFromServer(serverId, result.tools);
        return result.tools;
      } else {
        updateConnectionState(serverId, 'error', result.error);
        setError(result.error || 'Failed to connect');
        return null;
      }
    } catch (error) {
      console.error('Error connecting to server:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      updateConnectionState(serverId, 'error', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [updateConnectionState, addToolsFromServer, setError]);

  /**
   * Disconnect from a server
   */
  const disconnect = useCallback(async (serverId: string) => {
    try {
      const result = await window.electronAPI.mcp.disconnect(serverId);
      if (result.success) {
        updateConnectionState(serverId, 'disconnected');
        removeToolsFromServer(serverId);
        return true;
      } else {
        setError(result.error || 'Failed to disconnect');
        return false;
      }
    } catch (error) {
      console.error('Error disconnecting from server:', error);
      setError(error instanceof Error ? error.message : 'Failed to disconnect');
      return false;
    }
  }, [updateConnectionState, removeToolsFromServer, setError]);

  /**
   * Test connection to a server
   */
  const testConnection = useCallback(async (serverId: string) => {
    try {
      const result = await window.electronAPI.mcp.testConnection(serverId);
      return result.success ? result.result : null;
    } catch (error) {
      console.error('Error testing connection:', error);
      return null;
    }
  }, []);

  /**
   * Execute a tool
   */
  const executeTool = useCallback(async (
    serverId: string,
    toolName: string,
    input?: Record<string, unknown>
  ) => {
    const callId = `${serverId}:${toolName}:${Date.now()}`;
    addPendingCall(callId);

    try {
      const result = await window.electronAPI.mcp.executeTool(serverId, toolName, input);

      removePendingCall(callId);

      if (result.success && result.result) {
        addResult(result.result);
        return result.result;
      } else {
        setError(result.error || 'Failed to execute tool');
        return null;
      }
    } catch (error) {
      console.error('Error executing tool:', error);
      removePendingCall(callId);
      setError(error instanceof Error ? error.message : 'Failed to execute tool');
      return null;
    }
  }, [addPendingCall, removePendingCall, addResult, setError]);

  /**
   * Dismiss a result
   */
  const handleDismissResult = useCallback(async (resultId: string) => {
    dismissResult(resultId);
    try {
      await window.electronAPI.mcp.dismissResult(resultId);
    } catch (error) {
      console.error('Error dismissing result:', error);
    }
  }, [dismissResult]);

  /**
   * Pin a result
   */
  const handlePinResult = useCallback(async (resultId: string) => {
    pinResult(resultId);
    try {
      await window.electronAPI.mcp.pinResult(resultId);
    } catch (error) {
      console.error('Error pinning result:', error);
    }
  }, [pinResult]);

  /**
   * Update custom trigger keywords
   */
  const updateTriggerKeywords = useCallback(async (keywords: string[]) => {
    try {
      const result = await window.electronAPI.mcp.setTriggerKeywords(keywords);
      if (result.success) {
        setCustomTriggerKeywords(keywords);
        return true;
      } else {
        setError(result.error || 'Failed to update trigger keywords');
        return false;
      }
    } catch (error) {
      console.error('Error updating trigger keywords:', error);
      setError(error instanceof Error ? error.message : 'Failed to update trigger keywords');
      return false;
    }
  }, [setCustomTriggerKeywords, setError]);

  /**
   * Setup IPC event listeners
   */
  useEffect(() => {
    // Clean up previous listeners
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];

    // Subscribe to MCP events
    const unsubResult = window.electronAPI.mcpOn.onResult(({ result }) => {
      console.log('[MCP] Received result from main process:', {
        id: result.id,
        toolName: result.toolName,
        displayType: result.displayType,
        contentPreview: result.content?.text?.slice(0, 100),
      });
      addResult(result);
    });

    const unsubError = window.electronAPI.mcpOn.onError(({ serverId, toolName, error }) => {
      console.error('MCP error:', serverId, toolName, error);
      setError(`${toolName}: ${error}`);
    });

    const unsubConnected = window.electronAPI.mcpOn.onServerConnected(({ serverId, tools }) => {
      updateConnectionState(serverId, 'connected');
      addToolsFromServer(serverId, tools);
    });

    const unsubDisconnected = window.electronAPI.mcpOn.onServerDisconnected(({ serverId, reason }) => {
      updateConnectionState(serverId, 'disconnected');
      removeToolsFromServer(serverId);
      console.log('Server disconnected:', serverId, reason);
    });

    const unsubServerError = window.electronAPI.mcpOn.onServerError(({ serverId, error }) => {
      updateConnectionState(serverId, 'error', error);
      setError(`Server ${serverId}: ${error}`);
    });

    unsubscribersRef.current = [
      unsubResult,
      unsubError,
      unsubConnected,
      unsubDisconnected,
      unsubServerError,
    ];

    return () => {
      unsubscribersRef.current.forEach(unsub => unsub());
    };
  }, [
    addResult,
    setError,
    updateConnectionState,
    addToolsFromServer,
    removeToolsFromServer,
  ]);

  /**
   * Load data on mount
   */
  useEffect(() => {
    if (!isInitialized) {
      loadData();
    }
  }, [isInitialized, loadData]);

  return {
    // State
    servers,
    templates,
    connectionStates,
    availableTools,
    activeResults,
    visibleResults: activeResults.filter(r => !r.dismissed),
    pinnedResults: activeResults.filter(r => r.pinned && !r.dismissed),
    pendingCalls,
    isInitialized,
    autoTriggerEnabled,
    customTriggerKeywords,
    lastError,

    // Computed
    connectedServerCount: Object.values(connectionStates).filter(s => s.status === 'connected').length,
    toolCount: availableTools.length,

    // Actions
    loadData,
    createServer,
    updateServer: handleUpdateServer,
    deleteServer,
    connect,
    disconnect,
    testConnection,
    executeTool,
    dismissResult: handleDismissResult,
    pinResult: handlePinResult,
    clearResults,
    setAutoTriggerEnabled,
    updateTriggerKeywords,
    reset,
  };
}

export default useMCP;
