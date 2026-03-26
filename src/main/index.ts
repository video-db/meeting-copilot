import fixPath from 'fix-path';

fixPath();

import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, closeDatabase, getUserByAccessToken } from './db';
import { startServer, stopServer } from './server';
import {
  setupIpcHandlers,
  removeIpcHandlers,
  setMainWindow,
  setCopilotMainWindow,
  setMCPMainWindow,
  setCalendarMainWindow,
  setLiveAssistWindow,
  sendToRenderer,
  shutdownCaptureClient,
} from './ipc';
import { getTrayService, resetTrayService } from './services/tray.service';
import { getCalendarPoller, resetCalendarPoller } from './services/calendar-poller.service';
import { hasTokens } from './services/google-auth.service';
import {
  getConnectionOrchestrator,
  resetConnectionOrchestrator,
  getMCPAuthService,
} from './services/mcp';
import {
  loadAppConfig,
  loadRuntimeConfig,
  loadAuthConfig,
  deleteAuthConfig,
  saveAppConfig,
} from './lib/config';
import { logger } from './lib/logger';
import { applyVideoDBPatches } from './lib/videodb-patch';
import { getLockFilePath } from './lib/paths';
import { createSessionRecoveryService } from './services/session-recovery.service';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;
const PROTOCOL_NAME = 'call-md';

// Track if app is quitting (for hide-to-tray behavior)
let isAppQuitting = false;

export function setAppQuitting(value: boolean): void {
  isAppQuitting = value;
}

export function getAppQuitting(): boolean {
  return isAppQuitting;
}

/**
 * Register custom protocol handler for OAuth callbacks
 * This allows OAuth providers to redirect back to the app via call-md://oauth/callback
 */
function setupProtocolHandler(): void {
  // Register as default protocol handler (only works in packaged app)
  if (app.isPackaged) {
    const isRegistered = app.isDefaultProtocolClient(PROTOCOL_NAME);
    if (!isRegistered) {
      app.setAsDefaultProtocolClient(PROTOCOL_NAME);
      logger.info({ protocol: PROTOCOL_NAME }, 'Registered as default protocol client');
    }
  }

  // Handle protocol URL on macOS (when app is already running)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });
}

/**
 * Handle incoming protocol URL
 */
function handleProtocolUrl(url: string): void {
  logger.info({ url }, 'Received protocol URL');

  try {
    const parsedUrl = new URL(url);

    // Handle OAuth callback
    if (parsedUrl.hostname === 'oauth' && parsedUrl.pathname === '/callback') {
      const authService = getMCPAuthService();
      authService.handleCallback(url).catch((error) => {
        logger.error({ error, url }, 'Failed to handle OAuth callback');
      });

      // Focus the main window
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    } else {
      logger.warn({ url }, 'Unknown protocol URL path');
    }
  } catch (error) {
    logger.error({ error, url }, 'Failed to parse protocol URL');
  }
}

/**
 * Clean up stale recorder lock files so the recorder can start after crashes.
 */
function cleanupStaleLockFiles(): void {
  // Use stable paths because process.cwd() is unreliable in packaged apps.
  const lockFilePaths = [
    getLockFilePath('videodb-recorder.lock'),
    path.join(app.getPath('temp'), 'videodb-recorder.lock'),
    path.join(app.getPath('home'), '.videodb-recorder.lock'),
  ];

  for (const lockFile of lockFilePaths) {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        logger.info({ lockFile }, 'Removed stale recorder lock file');
      }
    } catch (error) {
      logger.warn({ error, lockFile }, 'Failed to remove lock file');
    }
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Call.md',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  setMainWindow(mainWindow);
  setCopilotMainWindow(mainWindow);
  setMCPMainWindow(mainWindow);
  setCalendarMainWindow(mainWindow);
  setLiveAssistWindow(mainWindow);

  if (isDev) {
    const VITE_DEV_PORT = 51730;
    await mainWindow.loadURL(`http://localhost:${VITE_DEV_PORT}`);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Hide to tray instead of closing (unless app is quitting)
  mainWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      // On macOS, hide the dock icon when minimized to tray
      if (process.platform === 'darwin') {
        app.dock?.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function autoRegister(): Promise<void> {
  const authConfig = loadAuthConfig();
  if (!authConfig) return;

  logger.info({ name: authConfig.name }, 'Auto-registering from auth_config.json');

  try {
    const runtimeConfig = loadRuntimeConfig();
    const response = await fetch(
      `http://localhost:${runtimeConfig.apiPort}/api/trpc/auth.register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            name: authConfig.name,
            apiKey: authConfig.apiKey,
          },
        }),
      }
    );

    const result = (await response.json()) as {
      result?: { data?: { json?: { success?: boolean; accessToken?: string; name?: string; error?: string } } };
    };

    if (result.result?.data?.json?.success) {
      const { accessToken, name } = result.result.data.json as { accessToken: string; name: string };

      saveAppConfig({
        accessToken,
        userName: name,
        apiKey: authConfig.apiKey,
      });

      logger.info({ name }, 'Auto-registration successful');

      if (mainWindow) {
        sendToRenderer('auth-success', { name, accessToken });
      }
    } else {
      logger.error({ error: result.result?.data?.json?.error }, 'Auto-registration failed');
    }
  } catch (error) {
    logger.error({ error }, 'Auto-registration error');
  } finally {
    deleteAuthConfig();
  }
}

/**
 * Recover recordings that were exported by VideoDB while the app was closed.
 * This checks for any recordings stuck in 'processing' status and updates them
 * if VideoDB has already completed the export.
 */
async function recoverPendingSessions(): Promise<void> {
  const appConfig = loadAppConfig();
  const runtimeConfig = loadRuntimeConfig();

  // Try to get API key from app config first
  let apiKey = appConfig.apiKey;

  // If not in config, look up the user in the database using the access token
  if (!apiKey && appConfig.accessToken) {
    const user = getUserByAccessToken(appConfig.accessToken);
    if (user) {
      apiKey = user.apiKey;
    }
  }

  if (!apiKey) {
    logger.debug('No API key available, skipping session recovery');
    return;
  }

  logger.info('Starting background session recovery...');

  try {
    const recoveryService = createSessionRecoveryService(
      apiKey,
      runtimeConfig.apiUrl
    );

    const result = await recoveryService.recoverPendingSessions();

    if (result.recovered > 0) {
      logger.info(
        { recovered: result.recovered, failed: result.failed, skipped: result.skipped },
        'Session recovery completed'
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMsg }, 'Background session recovery failed');
  }
}

async function startServices(): Promise<void> {
  const runtimeConfig = loadRuntimeConfig();
  const port = runtimeConfig.apiPort;

  initDatabase();

  const actualPort = await startServer(port);
  logger.info({ port: actualPort }, 'HTTP server started');

  // Initialize MCP orchestrator and connect to auto-connect servers
  logger.info('🔌 Initializing MCP Connection Orchestrator...');
  try {
    const mcpOrchestrator = getConnectionOrchestrator();
    await mcpOrchestrator.initialize();
    logger.info('🔌 MCP Connection Orchestrator initialized');
  } catch (mcpError) {
    logger.error({ error: mcpError }, '❌ MCP Orchestrator initialization failed');
  }
}

let isShuttingDown = false;

async function stopServices(): Promise<void> {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }
  isShuttingDown = true;

  // Stop calendar polling
  logger.info('Stopping calendar poller...');
  resetCalendarPoller();

  // Destroy tray
  logger.info('Destroying system tray...');
  resetTrayService();

  await shutdownCaptureClient();

  // Shutdown MCP orchestrator
  logger.info('🔌 Shutting down MCP Connection Orchestrator...');
  try {
    const mcpOrchestrator = getConnectionOrchestrator();
    await mcpOrchestrator.shutdown();
    resetConnectionOrchestrator();
    logger.info('🔌 MCP Connection Orchestrator shut down');
  } catch (mcpError) {
    logger.error({ error: mcpError }, '❌ MCP Orchestrator shutdown failed');
  }

  await stopServer();

  closeDatabase();

  removeIpcHandlers();
}

// Handle protocol URL from app launch (Windows/Linux cold start)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Handle protocol URL from second instance (Windows/Linux)
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_NAME}://`));
    if (url) {
      handleProtocolUrl(url);
    }

    // Focus the main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  logger.info('App starting');

  // Setup protocol handler for OAuth callbacks
  setupProtocolHandler();

  // Handle protocol URL from initial launch (macOS)
  const launchUrl = process.argv.find((arg) => arg.startsWith(`${PROTOCOL_NAME}://`));
  if (launchUrl) {
    // Defer handling until services are ready
    setTimeout(() => handleProtocolUrl(launchUrl), 1000);
  }

  // Only packaged apps need VideoDB binary path and DYLD_LIBRARY_PATH patches.
  if (app.isPackaged) {
    try {
      applyVideoDBPatches();
    } catch (error) {
      logger.error({ error }, 'Failed to apply VideoDB patches - recording may not work in production');
    }
  } else {
    logger.info('Skipping VideoDB patches in development mode');
  }

  cleanupStaleLockFiles();

  try {
    await startServices();

    setupIpcHandlers();

    createMenu();

    await createWindow();

    // Create system tray
    if (mainWindow) {
      getTrayService().create(mainWindow);
      logger.info('System tray created');
    }

    await autoRegister();

    // Start calendar polling if already authenticated
    if (hasTokens()) {
      logger.info('Google tokens found, starting calendar polling');
      const calendarPoller = getCalendarPoller();
      calendarPoller.startPolling().catch((err) => {
        logger.warn({ error: err.message }, 'Failed to start calendar polling on startup');
      });
    }

    // Recover any sessions that exported while app was closed (fire and forget)
    recoverPendingSessions().catch(() => {
      // Error already logged in recoverPendingSessions
    });

    logger.info('App started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start app');
    app.quit();
  }
});

// Don't quit when window closes - tray keeps it alive
app.on('window-all-closed', () => {
  // On non-macOS platforms, if we want the app to stay in tray,
  // we just do nothing here. The tray keeps the app alive.
  // Only quit if explicitly requested via tray menu.
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('before-quit', async (event) => {
  isAppQuitting = true;
  if (!isShuttingDown) {
    event.preventDefault();
    logger.info('App shutting down');
    await stopServices();
    app.exit(0);
  }
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT (Ctrl+C)');
  await stopServices();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM');
  await stopServices();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});
