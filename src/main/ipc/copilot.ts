/**
 * Meeting Co-Pilot IPC Handlers
 *
 * Handles IPC communication between main and renderer processes
 * for the Meeting Co-Pilot features.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createChildLogger } from '../lib/logger';
import {
  getMeetingCopilot,
  type CopilotConfig,
  type ConversationMetrics,
  type SentimentTrend,
  type Nudge,
  type CueCardTriggerData,
  type PlaybookItem,
  type PlaybookSnapshot,
  type CallSummary,
} from '../services/copilot';
import { getAllPlaybooks, getAllCueCards, getBookmarksByRecording, createBookmark } from '../db';
import { v4 as uuid } from 'uuid';

const logger = createChildLogger('copilot-ipc');

let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference for sending events
 */
export function setCopilotMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Send event to renderer
 */
function sendToRenderer(channel: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Setup Meeting Co-Pilot IPC handlers
 */
export function setupCopilotHandlers(): void {
  logger.info('Setting up Meeting Co-Pilot IPC handlers');

  const copilot = getMeetingCopilot();

  // Forward events to renderer
  copilot.on('transcript-segment', (segment) => {
    sendToRenderer('copilot:transcript', segment);
  });

  copilot.on('metrics-update', (data: { metrics: ConversationMetrics; health: number }) => {
    sendToRenderer('copilot:metrics', data);
  });

  copilot.on('sentiment-update', (data: { sentiment: SentimentTrend }) => {
    sendToRenderer('copilot:sentiment', data);
  });

  copilot.on('nudge', (data: { nudge: Nudge }) => {
    sendToRenderer('copilot:nudge', data);
  });

  copilot.on('cue-card', (data: { cueCard: CueCardTriggerData }) => {
    sendToRenderer('copilot:cue-card', data);
  });

  copilot.on('playbook-update', (data: { item: PlaybookItem; snapshot: PlaybookSnapshot }) => {
    sendToRenderer('copilot:playbook', data);
  });

  copilot.on('call-ended', (data: {
    summary: CallSummary;
    playbook?: PlaybookSnapshot;
    metrics: ConversationMetrics;
    duration: number;
  }) => {
    sendToRenderer('copilot:call-ended', data);
  });

  copilot.on('error', (data: { error: string; context?: string }) => {
    sendToRenderer('copilot:error', data);
  });

  // IPC Handlers

  /**
   * Initialize the copilot with API key
   */
  ipcMain.handle('copilot:initialize', async (_event, apiKey: string) => {
    try {
      copilot.initialize(apiKey);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to initialize copilot');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Start call tracking
   */
  ipcMain.handle('copilot:start-call', async (_event, recordingId: number, sessionId: string) => {
    try {
      await copilot.startCall(recordingId, sessionId);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to start call');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * End call and get summary
   */
  ipcMain.handle('copilot:end-call', async () => {
    try {
      const summary = await copilot.endCall();
      return { success: true, summary };
    } catch (error) {
      logger.error({ error }, 'Failed to end call');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Process transcript segment
   */
  ipcMain.handle('copilot:transcript', async (_event, channel: 'me' | 'them', data: {
    text: string;
    is_final: boolean;
    start: number;
    end: number;
  }) => {
    try {
      await copilot.onTranscriptReceived(channel, data);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to process transcript');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Update copilot configuration
   */
  ipcMain.handle('copilot:update-config', async (_event, config: Partial<CopilotConfig>) => {
    try {
      copilot.updateConfig(config);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to update config');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get current call state
   */
  ipcMain.handle('copilot:get-state', async () => {
    try {
      const state = copilot.getCallState();
      const metrics = copilot.getCurrentMetrics();
      const sentiment = copilot.getCurrentSentiment();
      const playbook = copilot.getPlaybookSnapshot();

      return {
        success: true,
        data: {
          state,
          metrics,
          sentiment,
          playbook,
          isActive: copilot.isCallActive(),
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get state');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Dismiss a cue card
   */
  ipcMain.handle('copilot:dismiss-cue-card', async (_event, triggerId: string) => {
    try {
      copilot.dismissCueCard(triggerId);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to dismiss cue card');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Pin a cue card
   */
  ipcMain.handle('copilot:pin-cue-card', async (_event, triggerId: string) => {
    try {
      copilot.pinCueCard(triggerId);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to pin cue card');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Submit cue card feedback
   */
  ipcMain.handle('copilot:cue-card-feedback', async (_event, triggerId: string, feedback: 'helpful' | 'wrong' | 'irrelevant') => {
    try {
      copilot.submitCueCardFeedback(triggerId, feedback);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to submit feedback');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Dismiss a nudge
   */
  ipcMain.handle('copilot:dismiss-nudge', async (_event, nudgeId: string) => {
    try {
      copilot.dismissNudge(nudgeId);
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to dismiss nudge');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get all playbooks
   */
  ipcMain.handle('copilot:get-playbooks', async () => {
    try {
      const playbooks = getAllPlaybooks();
      return {
        success: true,
        playbooks: playbooks.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          description: p.description,
          isDefault: p.isDefault,
          items: JSON.parse(p.items),
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get playbooks');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get all cue cards
   */
  ipcMain.handle('copilot:get-cue-cards', async () => {
    try {
      const cards = getAllCueCards();
      return {
        success: true,
        cueCards: cards.map(c => ({
          id: c.id,
          objectionType: c.objectionType,
          title: c.title,
          talkTracks: JSON.parse(c.talkTracks),
          followUpQuestions: JSON.parse(c.followUpQuestions),
          proofPoints: c.proofPoints ? JSON.parse(c.proofPoints) : undefined,
          avoidSaying: c.avoidSaying ? JSON.parse(c.avoidSaying) : undefined,
          sourceDoc: c.sourceDoc,
          isDefault: c.isDefault,
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get cue cards');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Create a bookmark
   */
  ipcMain.handle('copilot:create-bookmark', async (_event, data: {
    recordingId: number;
    segmentId?: string;
    timestamp: number;
    category: string;
    note?: string;
  }) => {
    try {
      const bookmark = createBookmark({
        id: uuid(),
        recordingId: data.recordingId,
        segmentId: data.segmentId || null,
        timestamp: data.timestamp,
        category: data.category as any,
        note: data.note || null,
      });
      return { success: true, bookmark };
    } catch (error) {
      logger.error({ error }, 'Failed to create bookmark');
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Get bookmarks for a recording
   */
  ipcMain.handle('copilot:get-bookmarks', async (_event, recordingId: number) => {
    try {
      const bookmarks = getBookmarksByRecording(recordingId);
      return { success: true, bookmarks };
    } catch (error) {
      logger.error({ error }, 'Failed to get bookmarks');
      return { success: false, error: (error as Error).message };
    }
  });

  logger.info('Meeting Co-Pilot IPC handlers registered');
}

/**
 * Remove Meeting Co-Pilot IPC handlers
 */
export function removeCopilotHandlers(): void {
  ipcMain.removeHandler('copilot:initialize');
  ipcMain.removeHandler('copilot:start-call');
  ipcMain.removeHandler('copilot:end-call');
  ipcMain.removeHandler('copilot:transcript');
  ipcMain.removeHandler('copilot:update-config');
  ipcMain.removeHandler('copilot:get-state');
  ipcMain.removeHandler('copilot:dismiss-cue-card');
  ipcMain.removeHandler('copilot:pin-cue-card');
  ipcMain.removeHandler('copilot:cue-card-feedback');
  ipcMain.removeHandler('copilot:dismiss-nudge');
  ipcMain.removeHandler('copilot:get-playbooks');
  ipcMain.removeHandler('copilot:get-cue-cards');
  ipcMain.removeHandler('copilot:create-bookmark');
  ipcMain.removeHandler('copilot:get-bookmarks');

  logger.info('Meeting Co-Pilot IPC handlers removed');
}
