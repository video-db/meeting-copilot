import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, closeDatabase } from './db';
import { startServer, stopServer } from './server';
import {
  setupIpcHandlers,
  removeIpcHandlers,
  setMainWindow,
  setCopilotMainWindow,
  setMCPMainWindow,
  sendToRenderer,
  shutdownCaptureClient,
} from './ipc';
import {
  getConnectionOrchestrator,
  resetConnectionOrchestrator,
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

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

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
    title: 'Meeting Copilot',
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

  if (isDev) {
    const VITE_DEV_PORT = 51730;
    await mainWindow.loadURL(`http://localhost:${VITE_DEV_PORT}`);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

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

app.whenReady().then(async () => {
  logger.info('App starting');

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

    await autoRegister();

    logger.info('App started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start app');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('before-quit', async (event) => {
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
