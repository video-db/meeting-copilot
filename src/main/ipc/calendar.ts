/**
 * Calendar IPC Handlers
 *
 * Handles IPC communication for Google Calendar integration.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createChildLogger } from '../lib/logger';
import {
  startAuthFlow,
  signOut,
  isAuthenticated,
  hasTokens,
} from '../services/google-auth.service';
import { fetchUpcomingEvents } from '../services/google-calendar.service';
import { getCalendarPoller } from '../services/calendar-poller.service';
import type {
  CalendarSignInResult,
  CalendarEventsResult,
  CalendarAuthStatusResult,
} from '../../shared/types/calendar.types';

const logger = createChildLogger('ipc-calendar');

let mainWindow: BrowserWindow | null = null;

export function setCalendarMainWindow(window: BrowserWindow): void {
  mainWindow = window;
  getCalendarPoller().setMainWindow(window);
}

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

export function setupCalendarHandlers(): void {
  logger.info('Setting up calendar IPC handlers');

  // Sign in with Google
  ipcMain.handle('calendar:sign-in', async (): Promise<CalendarSignInResult> => {
    try {
      logger.info('Starting Google sign-in flow');
      await startAuthFlow();

      // Start polling after successful sign-in
      const poller = getCalendarPoller();
      await poller.startPolling();

      logger.info('Google sign-in successful');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Google sign-in failed');
      return { success: false, error: err.message };
    }
  });

  // Sign out
  ipcMain.handle('calendar:sign-out', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      logger.info('Signing out of Google');

      // Stop polling first
      const poller = getCalendarPoller();
      poller.stopPolling();

      // Clear tokens
      signOut();

      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Google sign-out failed');
      return { success: false, error: err.message };
    }
  });

  // Check if signed in
  ipcMain.handle('calendar:is-signed-in', async (): Promise<CalendarAuthStatusResult> => {
    try {
      // Quick check first
      if (!hasTokens()) {
        return { success: true, isSignedIn: false };
      }

      // Verify tokens are still valid
      const authenticated = await isAuthenticated();
      return { success: true, isSignedIn: authenticated };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to check auth status');
      return { success: false, isSignedIn: false, error: err.message };
    }
  });

  // Get upcoming events
  ipcMain.handle('calendar:get-events', async (_event, hours?: number): Promise<CalendarEventsResult> => {
    try {
      const events = await fetchUpcomingEvents(hours || 24);
      return { success: true, events };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to fetch calendar events');
      return { success: false, error: err.message };
    }
  });

  // Set up event forwarding from poller
  const poller = getCalendarPoller();

  poller.on('auth-required', () => {
    logger.warn('Calendar auth required - forwarding to renderer');
    sendToRenderer('calendar:auth-required', {});
  });

  poller.on('events-updated', (events) => {
    sendToRenderer('calendar:events-updated', events);
  });

  logger.info('Calendar IPC handlers registered');
}

export function removeCalendarHandlers(): void {
  ipcMain.removeHandler('calendar:sign-in');
  ipcMain.removeHandler('calendar:sign-out');
  ipcMain.removeHandler('calendar:is-signed-in');
  ipcMain.removeHandler('calendar:get-events');

  logger.info('Calendar IPC handlers removed');
}
