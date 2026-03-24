import { ipcMain } from 'electron';
import { setupCaptureHandlers } from './capture';
import { setupPermissionHandlers } from './permissions';
import { setupAppHandlers } from './app';
import { setupCopilotHandlers, removeCopilotHandlers, setCopilotMainWindow } from './copilot';
import { setupMCPHandlers, removeMCPHandlers, setMCPMainWindow } from './mcp';
import { setupCalendarHandlers, removeCalendarHandlers, setCalendarMainWindow } from './calendar';
import { setupLiveAssistHandlers, setLiveAssistWindow, cleanupLiveAssist } from './live-assist';
import { setupWorkflowHandlers, removeWorkflowHandlers, setWorkflowsMainWindow } from './workflows';
import { createChildLogger } from '../lib/logger';

const logger = createChildLogger('ipc');

export function setupIpcHandlers(): void {
  logger.info('Setting up IPC handlers');

  setupCaptureHandlers();
  setupPermissionHandlers();
  setupAppHandlers();
  setupCopilotHandlers();
  setupMCPHandlers();
  setupCalendarHandlers();
  setupLiveAssistHandlers();
  setupWorkflowHandlers();

  logger.info('IPC handlers registered');
}

export function removeIpcHandlers(): void {
  // Capture handlers
  ipcMain.removeHandler('recorder-start-recording');
  ipcMain.removeHandler('recorder-stop-recording');
  ipcMain.removeHandler('recorder-pause-tracks');
  ipcMain.removeHandler('recorder-resume-tracks');
  ipcMain.removeHandler('recorder-list-channels');

  // Permission handlers
  ipcMain.removeHandler('check-mic-permission');
  ipcMain.removeHandler('check-screen-permission');
  ipcMain.removeHandler('check-accessibility-permission');
  ipcMain.removeHandler('request-mic-permission');
  ipcMain.removeHandler('request-screen-permission');
  ipcMain.removeHandler('open-system-settings');
  ipcMain.removeHandler('get-permission-status');

  // App handlers
  ipcMain.removeHandler('get-settings');
  ipcMain.removeHandler('get-server-port');
  ipcMain.removeHandler('logout');
  ipcMain.removeHandler('open-external-link');
  ipcMain.removeHandler('show-notification');
  ipcMain.removeHandler('open-player-window');

  // Meeting Co-Pilot handlers
  removeCopilotHandlers();

  // MCP handlers
  removeMCPHandlers();

  // Calendar handlers
  removeCalendarHandlers();

  // Live Assist handlers
  ipcMain.removeHandler('live-assist:start');
  ipcMain.removeHandler('live-assist:stop');
  ipcMain.removeHandler('live-assist:add-transcript');
  ipcMain.removeHandler('live-assist:clear');
  cleanupLiveAssist();

  // Workflow handlers
  removeWorkflowHandlers();

  logger.info('IPC handlers removed');
}

export { sendToRenderer, getMainWindow, setMainWindow, shutdownCaptureClient, isCaptureActive } from './capture';
export { setCopilotMainWindow } from './copilot';
export { setMCPMainWindow } from './mcp';
export { setCalendarMainWindow } from './calendar';
export { setLiveAssistWindow } from './live-assist';
export { setWorkflowsMainWindow } from './workflows';
