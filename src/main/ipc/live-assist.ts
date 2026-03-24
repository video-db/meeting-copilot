/**
 * Live Assist IPC Handlers
 *
 * Handles IPC communication for the live assist feature and MCP inference.
 * Forwards events from both services to the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { getLiveAssistService, resetLiveAssistService } from '../services/live-assist.service';
import { getMCPInferenceService, resetMCPInferenceService } from '../services/mcp-inference.service';
import { createChildLogger } from '../lib/logger';
import type { LiveAssistEvent } from '../../shared/types/live-assist.types';
import type { MCPDisplayResult } from '../../shared/types/mcp.types';

const logger = createChildLogger('ipc-live-assist');

let mainWindow: BrowserWindow | null = null;

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

export function setLiveAssistWindow(window: BrowserWindow): void {
  mainWindow = window;
}

export function setupLiveAssistHandlers(): void {
  // Start live assist (also starts MCP inference)
  ipcMain.handle('live-assist:start', async () => {
    logger.info('Starting live assist and MCP inference');

    // Start Live Assist service
    const liveAssistService = getLiveAssistService();
    liveAssistService.removeAllListeners('assists');
    liveAssistService.on('assists', (event: LiveAssistEvent) => {
      logger.info({ assistCount: event.assists.length }, 'Sending assists to renderer');
      sendToRenderer('live-assist:update', event);
    });
    liveAssistService.start();

    // Start MCP Inference service
    const mcpInferenceService = getMCPInferenceService();
    mcpInferenceService.removeAllListeners('result');
    mcpInferenceService.on('result', (result: MCPDisplayResult) => {
      logger.info({ resultId: result.id }, 'Sending MCP inference result to renderer');
      sendToRenderer('mcp:result', { result });
    });
    mcpInferenceService.start();

    return { success: true };
  });

  // Stop live assist (also stops MCP inference)
  ipcMain.handle('live-assist:stop', async () => {
    logger.info('Stopping live assist and MCP inference');

    const liveAssistService = getLiveAssistService();
    liveAssistService.stop();

    const mcpInferenceService = getMCPInferenceService();
    mcpInferenceService.stop();

    return { success: true };
  });

  // Add transcript (called from global recorder events)
  ipcMain.handle('live-assist:add-transcript', async (_event, text: string, source: 'mic' | 'system_audio') => {
    // Forward to both services
    const liveAssistService = getLiveAssistService();
    liveAssistService.addTranscript(text, source);

    const mcpInferenceService = getMCPInferenceService();
    mcpInferenceService.addTranscript(text, source);

    return { success: true };
  });

  // Clear live assist state
  ipcMain.handle('live-assist:clear', async () => {
    const liveAssistService = getLiveAssistService();
    liveAssistService.clear();

    const mcpInferenceService = getMCPInferenceService();
    mcpInferenceService.clear();

    return { success: true };
  });
}

export function cleanupLiveAssist(): void {
  resetLiveAssistService();
  resetMCPInferenceService();
}
