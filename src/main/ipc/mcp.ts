/**
 * MCP (Model Context Protocol) IPC Handlers
 *
 * Handles IPC communication between main and renderer processes
 * for MCP server management and tool execution.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createChildLogger } from '../lib/logger';
import {
  getConnectionOrchestrator,
  getToolAggregator,
  getResultHandler,
} from '../services/mcp';
import { getMeetingCopilot } from '../services/copilot';
import { getAllMCPServerTemplates, getMCPServerTemplate } from '../config/mcp-server-templates';
import { getMCPToolCallsByRecording, createMCPToolCall, updateMCPToolCall, getSetting, upsertSetting } from '../db';
import { getMCPAgent } from '../services/mcp';
import type {
  CreateMCPServerRequest,
  UpdateMCPServerRequest,
  MCPDisplayResult,
  MCPOAuthConfig,
} from '../../shared/types/mcp.types';
import { v4 as uuid } from 'uuid';

const logger = createChildLogger('mcp-ipc');

let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference for sending events
 */
export function setMCPMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Send event to renderer
 */
function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Setup MCP IPC handlers
 */
export function setupMCPHandlers(): void {
  logger.info('Setting up MCP IPC handlers');

  const orchestrator = getConnectionOrchestrator();
  const copilot = getMeetingCopilot();

  // Load saved trigger keywords and initialize MCP agent
  try {
    const setting = getSetting('mcp.triggerKeywords');
    if (setting) {
      const keywords = JSON.parse(setting.value);
      const mcpAgent = getMCPAgent();
      mcpAgent.setCustomTriggerKeywords(keywords);
      logger.info({ keywordCount: keywords.length }, 'Loaded saved MCP trigger keywords');
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to load saved trigger keywords');
  }

  // Forward MCP events from copilot to renderer
  copilot.on('mcp-result', (data: { result: MCPDisplayResult }) => {
    logger.info({
      resultId: data.result.id,
      toolName: data.result.toolName,
      displayType: data.result.displayType,
      hasContent: !!data.result.content,
      contentPreview: data.result.content?.text?.slice(0, 100),
    }, 'Forwarding MCP result to renderer');
    sendToRenderer('mcp:result', data);
  });

  copilot.on('mcp-error', (data: { serverId: string; toolName: string; error: string }) => {
    sendToRenderer('mcp:error', data);
  });

  // Forward orchestrator events to renderer
  orchestrator.on('server-connected', (data) => {
    sendToRenderer('mcp:server-connected', data);
  });

  orchestrator.on('server-disconnected', (data) => {
    sendToRenderer('mcp:server-disconnected', data);
  });

  orchestrator.on('server-error', (data) => {
    sendToRenderer('mcp:server-error', data);
  });

  // Forward OAuth events to renderer
  orchestrator.on('auth-required', (data) => {
    sendToRenderer('mcp:auth-required', data);
  });

  orchestrator.on('auth-success', (data) => {
    sendToRenderer('mcp:auth-success', data);
  });

  orchestrator.on('auth-error', (data) => {
    sendToRenderer('mcp:auth-error', data);
  });

  // Server Management Handlers

  /**
   * Get all configured MCP servers
   */
  ipcMain.handle('mcp:get-servers', async () => {
    try {
      const servers = orchestrator.getServers();
      const connectionStates = orchestrator.getConnectionStates();

      return {
        success: true,
        servers,
        connectionStates,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get servers');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get a specific server by ID
   */
  ipcMain.handle('mcp:get-server', async (_event, serverId: string) => {
    try {
      const server = orchestrator.getServer(serverId);
      if (!server) {
        return { success: false, error: 'Server not found' };
      }
      return { success: true, server };
    } catch (error) {
      logger.error({ error }, 'Failed to get server');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Create a new MCP server
   */
  ipcMain.handle('mcp:create-server', async (_event, request: CreateMCPServerRequest) => {
    try {
      const server = await orchestrator.createServer(request);
      return { success: true, server };
    } catch (error) {
      logger.error({ error }, 'Failed to create server');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Update an MCP server
   */
  ipcMain.handle('mcp:update-server', async (_event, serverId: string, request: UpdateMCPServerRequest) => {
    try {
      const server = await orchestrator.updateServer(serverId, request);
      if (!server) {
        return { success: false, error: 'Server not found' };
      }
      return { success: true, server };
    } catch (error) {
      logger.error({ error }, 'Failed to update server');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Delete an MCP server
   */
  ipcMain.handle('mcp:delete-server', async (_event, serverId: string) => {
    try {
      await orchestrator.deleteServer(serverId);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to delete server');
      return { success: false, error: (error as Error).message };
    }
  });

  // Connection Management Handlers

  /**
   * Connect to a server
   */
  ipcMain.handle('mcp:connect', async (_event, serverId: string) => {
    try {
      const tools = await orchestrator.connect(serverId);
      return { success: true, tools };
    } catch (error) {
      logger.error({ error }, 'Failed to connect to server');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Disconnect from a server
   */
  ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
    try {
      await orchestrator.disconnect(serverId);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to disconnect from server');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Test connection to a server
   */
  ipcMain.handle('mcp:test-connection', async (_event, serverId: string) => {
    try {
      const result = await orchestrator.testConnection(serverId);
      return { success: true, result };
    } catch (error) {
      logger.error({ error }, 'Failed to test connection');
      return { success: false, error: (error as Error).message };
    }
  });

  // Tool Management Handlers

  /**
   * Get all available tools from connected servers
   */
  ipcMain.handle('mcp:get-tools', async () => {
    try {
      const toolAggregator = getToolAggregator();
      const tools = toolAggregator.getAllTools();
      return { success: true, tools };
    } catch (error) {
      logger.error({ error }, 'Failed to get tools');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Execute a tool manually
   */
  ipcMain.handle('mcp:execute-tool', async (_event, serverId: string, toolName: string, input?: Record<string, unknown>) => {
    try {
      const toolAggregator = getToolAggregator();
      const resultHandler = getResultHandler();

      // Create tool call record
      const toolCallId = uuid();
      createMCPToolCall({
        id: toolCallId,
        serverId,
        toolName,
        toolInput: input ? JSON.stringify(input) : undefined,
        status: 'pending',
        triggerType: 'manual',
      });

      // Execute tool
      const result = await orchestrator.executeTool(serverId, toolName, input);

      // Update tool call record
      updateMCPToolCall(toolCallId, {
        toolOutput: result.result ? JSON.stringify(result.result) : undefined,
        status: result.status,
        errorMessage: result.error,
        durationMs: result.durationMs,
      });

      // Transform for display
      const tool = toolAggregator.findToolByNamespace(`${serverId}:${toolName}`);
      const displayResult = resultHandler.transformResult(result, tool?.tool, tool?.serverName);

      return { success: true, result: displayResult };
    } catch (error) {
      logger.error({ error }, 'Failed to execute tool');
      return { success: false, error: (error as Error).message };
    }
  });

  // Template Handlers

  /**
   * Get all server templates
   */
  ipcMain.handle('mcp:get-templates', async () => {
    try {
      const templates = getAllMCPServerTemplates();
      return { success: true, templates };
    } catch (error) {
      logger.error({ error }, 'Failed to get templates');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get a specific template
   */
  ipcMain.handle('mcp:get-template', async (_event, templateId: string) => {
    try {
      const template = getMCPServerTemplate(templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }
      return { success: true, template };
    } catch (error) {
      logger.error({ error }, 'Failed to get template');
      return { success: false, error: (error as Error).message };
    }
  });

  // History Handlers

  /**
   * Get tool calls for a recording
   */
  ipcMain.handle('mcp:get-tool-calls', async (_event, recordingId: number) => {
    try {
      const calls = getMCPToolCallsByRecording(recordingId);
      return { success: true, calls };
    } catch (error) {
      logger.error({ error }, 'Failed to get tool calls');
      return { success: false, error: (error as Error).message };
    }
  });

  // Result Management Handlers

  /**
   * Dismiss an MCP result
   */
  ipcMain.handle('mcp:dismiss-result', async (_event, resultId: string) => {
    try {
      // This is handled client-side in the store, but we can track it if needed
      logger.info({ resultId }, 'MCP result dismissed');
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to dismiss result');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Pin an MCP result
   */
  ipcMain.handle('mcp:pin-result', async (_event, resultId: string) => {
    try {
      // This is handled client-side in the store, but we can track it if needed
      logger.info({ resultId }, 'MCP result pinned');
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to pin result');
      return { success: false, error: (error as Error).message };
    }
  });

  // Trigger Keywords Handlers

  /**
   * Get custom trigger keywords
   */
  ipcMain.handle('mcp:get-trigger-keywords', async () => {
    try {
      const setting = getSetting('mcp.triggerKeywords');
      const keywords = setting ? JSON.parse(setting.value) : [];
      return { success: true, keywords };
    } catch (error) {
      logger.error({ error }, 'Failed to get trigger keywords');
      return { success: false, error: (error as Error).message, keywords: [] };
    }
  });

  /**
   * Set custom trigger keywords
   */
  ipcMain.handle('mcp:set-trigger-keywords', async (_event, keywords: string[]) => {
    try {
      upsertSetting({
        key: 'mcp.triggerKeywords',
        value: JSON.stringify(keywords),
        category: 'config',
        label: 'MCP Trigger Keywords',
        description: 'Custom keywords that trigger MCP agent tool lookups',
      });

      // Update the MCP agent with the new keywords
      const mcpAgent = getMCPAgent();
      mcpAgent.setCustomTriggerKeywords(keywords);

      logger.info({ keywordCount: keywords.length }, 'MCP trigger keywords updated');
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to set trigger keywords');
      return { success: false, error: (error as Error).message };
    }
  });

  // OAuth Handlers

  /**
   * Start OAuth flow for a server
   */
  ipcMain.handle('mcp:start-oauth', async (_event, serverId: string, oauthConfig: MCPOAuthConfig) => {
    try {
      await orchestrator.startOAuthFlow(serverId, oauthConfig);
      return { success: true };
    } catch (error) {
      logger.error({ error, serverId }, 'Failed to start OAuth flow');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Connect with OAuth (checks for existing tokens first)
   */
  ipcMain.handle('mcp:connect-with-auth', async (_event, serverId: string, oauthConfig?: MCPOAuthConfig) => {
    try {
      const tools = await orchestrator.connectWithAuth(serverId, oauthConfig);
      return { success: true, tools };
    } catch (error) {
      logger.error({ error, serverId }, 'Failed to connect with auth');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Check if server requires OAuth
   */
  ipcMain.handle('mcp:requires-auth', async (_event, serverId: string) => {
    try {
      const requiresAuth = orchestrator.serverRequiresAuth(serverId);
      return { success: true, requiresAuth };
    } catch (error) {
      logger.error({ error, serverId }, 'Failed to check auth requirement');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Check if server has valid OAuth tokens
   */
  ipcMain.handle('mcp:has-valid-tokens', async (_event, serverId: string) => {
    try {
      const hasTokens = orchestrator.hasValidTokens(serverId);
      return { success: true, hasTokens };
    } catch (error) {
      logger.error({ error, serverId }, 'Failed to check tokens');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Delete OAuth tokens for a server
   */
  ipcMain.handle('mcp:delete-tokens', async (_event, serverId: string) => {
    try {
      orchestrator.deleteTokens(serverId);
      return { success: true };
    } catch (error) {
      logger.error({ error, serverId }, 'Failed to delete tokens');
      return { success: false, error: (error as Error).message };
    }
  });

  logger.info('MCP IPC handlers registered');
}

/**
 * Remove MCP IPC handlers
 */
export function removeMCPHandlers(): void {
  ipcMain.removeHandler('mcp:get-servers');
  ipcMain.removeHandler('mcp:get-server');
  ipcMain.removeHandler('mcp:create-server');
  ipcMain.removeHandler('mcp:update-server');
  ipcMain.removeHandler('mcp:delete-server');
  ipcMain.removeHandler('mcp:connect');
  ipcMain.removeHandler('mcp:disconnect');
  ipcMain.removeHandler('mcp:test-connection');
  ipcMain.removeHandler('mcp:get-tools');
  ipcMain.removeHandler('mcp:execute-tool');
  ipcMain.removeHandler('mcp:get-templates');
  ipcMain.removeHandler('mcp:get-template');
  ipcMain.removeHandler('mcp:get-tool-calls');
  ipcMain.removeHandler('mcp:dismiss-result');
  ipcMain.removeHandler('mcp:pin-result');
  ipcMain.removeHandler('mcp:get-trigger-keywords');
  ipcMain.removeHandler('mcp:set-trigger-keywords');
  // OAuth handlers
  ipcMain.removeHandler('mcp:start-oauth');
  ipcMain.removeHandler('mcp:connect-with-auth');
  ipcMain.removeHandler('mcp:requires-auth');
  ipcMain.removeHandler('mcp:has-valid-tokens');
  ipcMain.removeHandler('mcp:delete-tokens');

  logger.info('MCP IPC handlers removed');
}
