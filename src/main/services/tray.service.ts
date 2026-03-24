/**
 * Tray Service
 *
 * Creates and manages the system tray icon with context menu
 * showing upcoming meetings.
 */

import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';
import { logger } from '../lib/logger';
import { getCalendarPoller } from './calendar-poller.service';
import { setAppQuitting } from '../index';
import type { UpcomingMeeting } from '../../shared/types/calendar.types';

const log = logger.child({ module: 'tray' });

class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private cachedEvents: UpcomingMeeting[] = [];

  /**
   * Create the system tray
   */
  create(mainWindow: BrowserWindow): Tray {
    this.mainWindow = mainWindow;

    // Create tray icon
    const iconPath = this.getIconPath();
    let icon: Electron.NativeImage;

    try {
      icon = nativeImage.createFromPath(iconPath);
      // Resize for tray (16x16 on most platforms)
      // Don't set as template - using colored VideoDB logo
      icon = icon.resize({ width: 16, height: 16 });
    } catch (error) {
      log.warn({ error }, 'Failed to load tray icon, using empty');
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('Meeting Copilot');

    // On macOS, clicking tray icon should show context menu (default behavior)
    // On Windows/Linux, double-click opens the app
    if (process.platform !== 'darwin') {
      this.tray.on('double-click', () => {
        this.showMainWindow();
      });
    }

    // Initial menu
    this.updateMenu([]);

    // Listen for calendar events updates
    const poller = getCalendarPoller();
    poller.on('events-updated', (events: UpcomingMeeting[]) => {
      this.cachedEvents = events;
      this.updateMenu(events);
    });

    poller.on('auth-required', () => {
      this.tray?.setToolTip('Meeting Copilot - Reconnect needed');
    });

    log.info('Tray created');

    return this.tray;
  }

  /**
   * Get the path to the tray icon
   */
  private getIconPath(): string {
    // In packaged app, icons are in resources/
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'resources', 'icon.png');
    }
    // In development, look in resources/
    return path.join(app.getAppPath(), 'resources', 'icon.png');
  }

  /**
   * Update the tray context menu with upcoming events
   */
  updateMenu(events: UpcomingMeeting[]): void {
    if (!this.tray) return;

    const menuItems: Electron.MenuItemConstructorOptions[] = [];

    // Add upcoming events (max 8)
    if (events.length > 0) {
      const displayEvents = events.slice(0, 8);

      for (const event of displayEvents) {
        const time = event.isAllDay
          ? 'All day'
          : event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const label = `${time}  ${event.summary}`;

        menuItems.push({
          label,
          click: () => {
            this.showMainWindow();
          },
        });
      }
    } else {
      menuItems.push({
        label: 'No upcoming meetings',
        enabled: false,
      });
    }

    menuItems.push({ type: 'separator' });

    menuItems.push({
      label: 'Open Meeting Copilot',
      click: () => {
        this.showMainWindow();
      },
    });

    menuItems.push({ type: 'separator' });

    menuItems.push({
      label: 'Quit',
      click: () => {
        setAppQuitting(true);
        app.quit();
      },
    });

    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);

    // Update tooltip with next meeting info
    if (events.length > 0 && !events[0].isAllDay) {
      const next = events[0];
      const mins = next.minutesUntil;
      if (mins <= 60) {
        this.tray.setToolTip(`Meeting Copilot - "${next.summary}" in ${mins}m`);
      } else {
        this.tray.setToolTip('Meeting Copilot');
      }
    } else {
      this.tray.setToolTip('Meeting Copilot');
    }
  }

  /**
   * Show and focus the main window
   */
  showMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      log.warn('Main window not available');
      return;
    }

    this.mainWindow.show();
    this.mainWindow.focus();

    // On macOS, also show the dock icon
    if (process.platform === 'darwin') {
      app.dock?.show();
    }
  }

  /**
   * Destroy the tray
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    log.info('Tray destroyed');
  }

  /**
   * Get the tray instance
   */
  getTray(): Tray | null {
    return this.tray;
  }
}

// Singleton instance
let instance: TrayService | null = null;

export function getTrayService(): TrayService {
  if (!instance) {
    instance = new TrayService();
  }
  return instance;
}

export function resetTrayService(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

export { TrayService };
