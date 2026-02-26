import { ipcMain, systemPreferences, shell } from 'electron';
import type { PermissionStatus } from '../../shared/types/ipc.types';
import { createChildLogger } from '../lib/logger';

const logger = createChildLogger('ipc-permissions');

export function setupPermissionHandlers(): void {
  ipcMain.handle('check-mic-permission', async (): Promise<boolean> => {
    if (process.platform !== 'darwin') return true;

    const status = systemPreferences.getMediaAccessStatus('microphone');
    logger.debug({ status }, 'Microphone permission status');
    return status === 'granted';
  });

  ipcMain.handle('check-screen-permission', async (): Promise<boolean> => {
    if (process.platform !== 'darwin') return true;

    const status = systemPreferences.getMediaAccessStatus('screen');
    logger.debug({ status }, 'Screen permission status');
    return status === 'granted';
  });

  ipcMain.handle('check-accessibility-permission', async (): Promise<boolean> => {
    if (process.platform !== 'darwin') return true;

    // On macOS, we check if we have accessibility permissions
    // This is typically required for screen recording
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    logger.debug({ isTrusted }, 'Accessibility permission status');
    return isTrusted;
  });

  ipcMain.handle('request-mic-permission', async (): Promise<boolean> => {
    if (process.platform !== 'darwin') return true;

    try {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      logger.info({ granted }, 'Microphone permission request result');
      return granted;
    } catch (error) {
      logger.error({ error }, 'Failed to request microphone permission');
      return false;
    }
  });

  ipcMain.handle('request-screen-permission', async (): Promise<boolean> => {
    if (process.platform !== 'darwin') return true;

    // Screen capture permission cannot be requested programmatically on macOS
    // We need to direct users to System Preferences
    const status = systemPreferences.getMediaAccessStatus('screen');

    if (status !== 'granted') {
      // Open System Preferences to Screen Recording
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
      return false;
    }

    return true;
  });

  ipcMain.handle('open-system-settings', async (_event, pane: string): Promise<void> => {
    if (process.platform !== 'darwin') return;

    const paneMap: Record<string, string> = {
      microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
    };

    const url = paneMap[pane];
    if (url) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('get-permission-status', async (): Promise<PermissionStatus> => {
    if (process.platform !== 'darwin') {
      return {
        microphone: true,
        screen: true,
        accessibility: true,
      };
    }

    return {
      microphone: systemPreferences.getMediaAccessStatus('microphone') === 'granted',
      screen: systemPreferences.getMediaAccessStatus('screen') === 'granted',
      accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    };
  });
}
