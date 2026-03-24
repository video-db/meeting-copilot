/**
 * Calendar Poller Service
 *
 * Polls Google Calendar every 60 seconds and shows native notifications
 * for meetings starting within 2 minutes.
 */

import { Notification, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import { logger } from '../lib/logger';
import { fetchUpcomingEvents, CalendarAuthError } from './google-calendar.service';
import { isAuthenticated } from './google-auth.service';
import { getCalendarPreferences } from '../db';
import type { UpcomingMeeting } from '../../shared/types/calendar.types';
import type { RecordingBehavior } from '../db/schema';

const log = logger.child({ module: 'calendar-poller' });

// Polling configuration
const POLL_INTERVAL_MS = 20_000; // 20 seconds
const DEFAULT_NOTIFY_MINUTES_BEFORE = 2; // Default: notify 2 minutes before meeting
const UPCOMING_HOURS = 24; // Fetch events within next 24 hours

class CalendarPollerService extends EventEmitter {
  private pollInterval: NodeJS.Timeout | null = null;
  private notifiedEventIds: Set<string> = new Set();
  private cachedEvents: UpcomingMeeting[] = [];
  private mainWindow: BrowserWindow | null = null;
  private isPolling: boolean = false;

  /**
   * Set the main window reference for showing on notification click
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Start polling for calendar events
   */
  async startPolling(): Promise<void> {
    if (this.pollInterval) {
      log.debug('Polling already started');
      return;
    }

    // Check if authenticated before starting
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      log.warn('Cannot start polling - not authenticated');
      return;
    }

    // Log notification support
    log.info({ notificationSupported: Notification.isSupported() }, 'Notification support check');

    this.isPolling = true;
    log.info('Starting calendar polling');

    // Poll immediately, then every interval
    await this.pollAndNotify();

    this.pollInterval = setInterval(async () => {
      await this.pollAndNotify();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    this.cachedEvents = [];
    log.info('Stopped calendar polling');
  }

  /**
   * Check if currently polling
   */
  getIsPolling(): boolean {
    return this.isPolling;
  }

  /**
   * Get cached events
   */
  getCachedEvents(): UpcomingMeeting[] {
    return this.cachedEvents;
  }

  /**
   * Poll for events and send notifications
   */
  private async pollAndNotify(): Promise<void> {
    try {
      log.debug('Polling calendar events');

      // Get user preferences from DB
      const prefs = getCalendarPreferences();
      const notifyMinutes = prefs?.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES_BEFORE;
      const recordingBehavior = prefs?.recordingBehavior ?? 'always_ask';

      // If user chose "no_notification", skip notifications entirely
      if (recordingBehavior === 'no_notification') {
        log.debug('Recording behavior is no_notification - skipping notifications');
        // Still fetch events for other purposes (e.g., tray display)
        this.cachedEvents = await fetchUpcomingEvents(UPCOMING_HOURS);
        this.emit('events-updated', this.cachedEvents);
        return;
      }

      // Fetch upcoming events
      this.cachedEvents = await fetchUpcomingEvents(UPCOMING_HOURS);

      // Prune old notification IDs (events that have passed)
      this.pruneOldNotifications();

      // Check for events starting soon
      const toNotify = this.checkForUpcomingNotifications(notifyMinutes, recordingBehavior);

      // Send notifications
      for (const event of toNotify) {
        this.sendEventNotification(event, recordingBehavior);
      }

      // Emit events updated for tray/UI
      this.emit('events-updated', this.cachedEvents);

      log.debug({ eventCount: this.cachedEvents.length, notifyCount: toNotify.length }, 'Poll complete');
    } catch (error) {
      const err = error as Error;
      log.error({ error: err.message }, 'Calendar poll failed');

      // Check if it's an auth error
      if (error instanceof CalendarAuthError) {
        log.warn('Auth error during polling - stopping and emitting auth-required');
        this.stopPolling();
        this.emit('auth-required');
      }
    }
  }

  /**
   * Check for events that should trigger a notification
   */
  private checkForUpcomingNotifications(notifyMinutes: number, recordingBehavior: RecordingBehavior): UpcomingMeeting[] {
    const toNotify: UpcomingMeeting[] = [];
    const thresholdMs = notifyMinutes * 60 * 1000;

    for (const event of this.cachedEvents) {
      // Skip all-day events
      if (event.isAllDay) continue;

      const msUntil = event.startTime.getTime() - Date.now();

      // Event is starting within threshold and we haven't notified yet
      if (msUntil > 0 && msUntil <= thresholdMs && !this.notifiedEventIds.has(event.id)) {
        this.notifiedEventIds.add(event.id);
        toNotify.push(event);
      }
    }

    return toNotify;
  }

  /**
   * Prune notification IDs for events that have passed
   */
  private pruneOldNotifications(): void {
    const currentIds = new Set(this.cachedEvents.map(e => e.id));

    for (const id of this.notifiedEventIds) {
      if (!currentIds.has(id)) {
        this.notifiedEventIds.delete(id);
      }
    }
  }

  /**
   * Send a native notification for an upcoming event
   */
  private sendEventNotification(event: UpcomingMeeting, recordingBehavior: RecordingBehavior): void {
    const minutes = event.minutesUntil;
    let body = minutes <= 1 ? 'Starting now' : `Starts in ${minutes} minute${minutes === 1 ? '' : 's'}`;

    // Add recording hint based on behavior
    if (recordingBehavior === 'default_record') {
      body += ' - Will auto-record';
    } else if (recordingBehavior === 'always_ask') {
      body += ' - Click to record';
    }

    // Check if notifications are supported
    if (!Notification.isSupported()) {
      log.warn('Notifications are not supported on this system');
      return;
    }

    log.info({
      eventId: event.id,
      summary: event.summary,
      minutesUntil: minutes,
      recordingBehavior,
      notificationSupported: Notification.isSupported(),
    }, 'Sending notification');

    const notification = new Notification({
      title: event.summary,
      body,
      urgency: 'critical',
    });

    notification.on('click', () => {
      log.info({ eventId: event.id }, 'Notification clicked');
      this.showMainWindow();
    });

    notification.on('show', () => {
      log.info({ eventId: event.id }, 'Notification shown');
    });

    notification.on('failed', (error) => {
      log.error({ eventId: event.id, error }, 'Notification failed');
    });

    notification.on('close', () => {
      log.debug({ eventId: event.id }, 'Notification closed');
    });

    notification.show();
    log.debug({ eventId: event.id }, 'notification.show() called');
  }

  /**
   * Show and focus the main window
   */
  private showMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      log.warn('Main window not available');
      return;
    }

    this.mainWindow.show();
    this.mainWindow.focus();

    // On macOS, also show the dock icon
    if (process.platform === 'darwin') {
      const { app } = require('electron');
      app.dock?.show();
    }
  }

  /**
   * Clear all cached state
   */
  reset(): void {
    this.notifiedEventIds.clear();
    this.cachedEvents = [];
  }
}

// Singleton instance
let instance: CalendarPollerService | null = null;

export function getCalendarPoller(): CalendarPollerService {
  if (!instance) {
    instance = new CalendarPollerService();
  }
  return instance;
}

export function resetCalendarPoller(): void {
  if (instance) {
    instance.stopPolling();
    instance.reset();
    instance = null;
  }
}

export { CalendarPollerService };
