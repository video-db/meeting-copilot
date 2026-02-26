import { ipcMain, BrowserWindow, app } from 'electron';
import { CaptureClient } from 'videodb/capture';
import { connect } from 'videodb';
import type { WebSocketConnection, WebSocketMessage } from 'videodb';
import type { Channel } from '../../shared/schemas/capture.schema';
import type { RecorderEvent, TranscriptEvent, StartRecordingParams } from '../../shared/types/ipc.types';
import { registerSessionUser } from '../server/routes/webhook';
import { createChildLogger } from '../lib/logger';
import { applyVideoDBPatches } from '../lib/videodb-patch';

const logger = createChildLogger('ipc-capture');

let mainWindow: BrowserWindow | null = null;
let captureClient: CaptureClient | null = null;

// Store bound event handlers so we can remove them later to prevent memory leaks
const captureEventHandlers: {
  'recording:started'?: () => void;
  'recording:stopped'?: () => void;
  'recording:error'?: (error: unknown) => void;
  'upload:progress'?: (progress: unknown) => void;
  'upload:complete'?: (data: unknown) => void;
  'error'?: (error: unknown) => void;
} = {};

let micWebSocket: WebSocketConnection | null = null;
let sysAudioWebSocket: WebSocketConnection | null = null;
let transcriptListenerActive = false;

function ensureVideoDBPatched(): void {
  if (!app.isPackaged) return;
  try {
    applyVideoDBPatches();
  } catch (error) {
    logger.error({ error }, 'Failed to apply VideoDB patches before CaptureClient usage');
  }
}

async function setupTranscriptWebSockets(
  sessionToken: string,
  apiUrl?: string
): Promise<{ micWsId: string | null; sysAudioWsId: string | null } | null> {
  try {
    if (!sessionToken) {
      logger.warn('[WS] No session token');
      return null;
    }

    const connectOptions: { sessionToken: string; baseUrl?: string } = { sessionToken };
    if (apiUrl) {
      connectOptions.baseUrl = apiUrl;
    }
    const videodbConnection = connect(connectOptions);

    const [micWsResult, sysWsResult] = await Promise.all([
      (async () => {
        try {
          const wsConnection = await videodbConnection.connectWebsocket();
          micWebSocket = await wsConnection.connect();
          logger.info({ connectionId: micWebSocket.connectionId }, '[WS] Mic WebSocket connected');
          return { ws: micWebSocket, id: micWebSocket.connectionId || null };
        } catch (err) {
          logger.error({ error: err }, '[WS] Failed to create mic WebSocket');
          return { ws: null, id: null };
        }
      })(),
      (async () => {
        try {
          const wsConnection = await videodbConnection.connectWebsocket();
          sysAudioWebSocket = await wsConnection.connect();
          logger.info({ connectionId: sysAudioWebSocket.connectionId }, '[WS] SysAudio WebSocket connected');
          return { ws: sysAudioWebSocket, id: sysAudioWebSocket.connectionId || null };
        } catch (err) {
          logger.error({ error: err }, '[WS] Failed to create sys_audio WebSocket');
          return { ws: null, id: null };
        }
      })(),
    ]);

    if (!micWsResult.id && !sysWsResult.id) {
      logger.error('[WS] Failed to create any WebSocket connections');
      return null;
    }

    transcriptListenerActive = true;
    if (micWsResult.ws) listenForMessages(micWsResult.ws, 'mic');
    if (sysWsResult.ws) listenForMessages(sysWsResult.ws, 'system_audio');

    return { micWsId: micWsResult.id, sysAudioWsId: sysWsResult.id };
  } catch (err) {
    logger.error({ error: err }, '[WS] Error setting up WebSockets');
    return null;
  }
}

async function listenForMessages(ws: WebSocketConnection, source: 'mic' | 'system_audio'): Promise<void> {
  try {
    for await (const msg of ws.receive()) {
      if (!transcriptListenerActive) break;

      const channel = (msg.channel || msg.type || msg.event_type || 'event') as string;

      if (channel === 'transcript' || msg.text) {
        const msgData = msg.data as Record<string, unknown>;
        const text = (msgData.text || msg.text || '') as string;
        const isFinal = (msgData.is_final ?? msg.is_final ?? msg.isFinal ?? false) as boolean;
      const start = (msgData.start ?? msg.start) as number;
      const end = (msgData.end ?? msg.end) as number;

      if (isFinal) {
        }

        const transcriptEvent: TranscriptEvent = {
          text,
          isFinal,
          source,
          start,
          end,
        };

        sendRecorderEvent({
          event: 'transcript',
          data: transcriptEvent,
        });
      }
    }
  } catch (err) {
    if (transcriptListenerActive) {
      logger.error({ error: err, source }, '[WS] Error in listener');
    }
  }
}

async function cleanupTranscriptWebSockets(): Promise<void> {
  transcriptListenerActive = false;

  if (micWebSocket) {
    try {
      await micWebSocket.close();
    } catch (e) {
      // Ignore close errors
    }
    micWebSocket = null;
  }

  if (sysAudioWebSocket) {
    try {
      await sysAudioWebSocket.close();
    } catch (e) {
      // Ignore close errors
    }
    sysAudioWebSocket = null;
  }
}

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function sendRecorderEvent(event: RecorderEvent): void {
  sendToRenderer('recorder-event', event);
}

// Set up event listeners with stored references to prevent memory leaks
function setupCaptureEventListeners(): void {
  if (!captureClient) return;

  captureEventHandlers['recording:started'] = () => {
    logger.info('Recording started');
    sendRecorderEvent({ event: 'recording:started' });
  };

  captureEventHandlers['recording:stopped'] = () => {
    logger.info('Recording stopped');
    sendRecorderEvent({ event: 'recording:stopped' });
  };

  captureEventHandlers['recording:error'] = (error: unknown) => {
    logger.error({ error }, 'Recording error');
    sendRecorderEvent({ event: 'recording:error', data: error });
  };

  captureEventHandlers['upload:progress'] = (progress: unknown) => {
    sendRecorderEvent({ event: 'upload:progress', data: progress });
  };

  captureEventHandlers['upload:complete'] = (data: unknown) => {
    logger.info('Upload complete');
    sendRecorderEvent({ event: 'upload:complete', data });
  };

  captureEventHandlers['error'] = (error: unknown) => {
    logger.error({ error }, 'CaptureClient error');
    sendRecorderEvent({ event: 'error', data: error });
  };

  captureClient.on('recording:started', captureEventHandlers['recording:started']);
  captureClient.on('recording:stopped', captureEventHandlers['recording:stopped']);
  captureClient.on('recording:error', captureEventHandlers['recording:error']);
  captureClient.on('upload:progress', captureEventHandlers['upload:progress']);
  captureClient.on('upload:complete', captureEventHandlers['upload:complete']);
  captureClient.on('error', captureEventHandlers['error']);
}

function removeCaptureEventListeners(): void {
  if (!captureClient) return;

  // Cast to access EventEmitter methods not in CaptureClient's type definition
  const emitter = captureClient as unknown as {
    removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
  };

  if (captureEventHandlers['recording:started']) {
    emitter.removeListener('recording:started', captureEventHandlers['recording:started']);
  }
  if (captureEventHandlers['recording:stopped']) {
    emitter.removeListener('recording:stopped', captureEventHandlers['recording:stopped']);
  }
  if (captureEventHandlers['recording:error']) {
    emitter.removeListener('recording:error', captureEventHandlers['recording:error']);
  }
  if (captureEventHandlers['upload:progress']) {
    emitter.removeListener('upload:progress', captureEventHandlers['upload:progress']);
  }
  if (captureEventHandlers['upload:complete']) {
    emitter.removeListener('upload:complete', captureEventHandlers['upload:complete']);
  }
  if (captureEventHandlers['error']) {
    emitter.removeListener('error', captureEventHandlers['error']);
  }

  Object.keys(captureEventHandlers).forEach((key) => {
    delete captureEventHandlers[key as keyof typeof captureEventHandlers];
  });
}

export function setupCaptureHandlers(): void {
  ipcMain.handle(
    'recorder-start-recording',
    async (
      _event,
      params: StartRecordingParams
    ): Promise<{
      success: boolean;
      sessionId?: string;
      error?: string;
      micWsConnectionId?: string;
      sysAudioWsConnectionId?: string;
    }> => {
      const { config, sessionToken, accessToken, apiUrl, enableTranscription } = params;

      logger.info({ sessionId: config.sessionId, enableTranscription }, 'Starting recording - IPC handler called');

      try {
        registerSessionUser(config.sessionId, accessToken);

        let wsConnectionIds: { micWsId: string | null; sysAudioWsId: string | null } | null = null;
        if (enableTranscription) {
          wsConnectionIds = await setupTranscriptWebSockets(sessionToken, apiUrl);
          if (wsConnectionIds) {
            logger.info(
              { micWsId: wsConnectionIds.micWsId, sysAudioWsId: wsConnectionIds.sysAudioWsId },
              '[WS] WebSocket connections established'
            );
          }
        }

        // Create fresh CaptureClient each time (Python pattern)
        if (captureClient) {
          logger.info('Cleaning up existing CaptureClient before creating new one');
          removeCaptureEventListeners();
          try {
            await captureClient.shutdown();
          } catch (e) {
            // Ignore shutdown errors
          }
          captureClient = null;
        }

        ensureVideoDBPatched();
        logger.info('Creating new CaptureClient');
        captureClient = new CaptureClient({
            sessionToken,
            ...(apiUrl && { apiUrl }),
          });

        // Set up event listeners BEFORE listing channels (Python pattern)
        setupCaptureEventListeners();

        let captureChannels: Array<{ channelId: string; type: 'audio' | 'video'; record: boolean; transcript?: boolean }> = [];
        
        try {
          logger.info('Listing available channels');
          const channels = await captureClient.listChannels();
          logger.info({ channelCount: channels.all().length }, 'Channels listed successfully');

          const micChannel = channels.mics.default;
          if (micChannel && config.streams?.microphone !== false) {
            captureChannels.push({
              channelId: micChannel.id,
              type: 'audio',
              record: true,
              transcript: enableTranscription,
            });
          }

          const systemAudioChannel = channels.systemAudio.default;
          if (systemAudioChannel && config.streams?.systemAudio !== false) {
            captureChannels.push({
              channelId: systemAudioChannel.id,
              type: 'audio',
              record: true,
              transcript: enableTranscription,
            });
          }

          const displayChannel = channels.displays.default;
          if (displayChannel && config.streams?.screen !== false) {
            captureChannels.push({
              channelId: displayChannel.id,
              type: 'video',
              record: true,
            });
          }

          logger.info({ captureChannels }, 'Channel configs prepared from listed channels');
        } catch (listError) {
          logger.warn({ error: listError }, 'listChannels failed, using fallback channel IDs');
          
          if (config.streams?.microphone !== false) {
            captureChannels.push({ channelId: 'mic', type: 'audio', record: true, transcript: enableTranscription });
          }
          if (config.streams?.systemAudio !== false) {
            captureChannels.push({ channelId: 'system_audio', type: 'audio', record: true, transcript: enableTranscription });
          }
          if (config.streams?.screen !== false) {
            captureChannels.push({ channelId: 'screen', type: 'video', record: true });
          }
          
          logger.info({ captureChannels }, 'Using fallback channel IDs');
        }

        if (captureChannels.length === 0) {
          throw new Error('No capture channels available. Check permissions.');
        }

        if (captureChannels.length === 0) {
          throw new Error('No capture channels available. Check permissions.');
        }

        logger.info({ captureChannels }, 'Starting capture with channels');
        try {
          await captureClient.startSession({
            sessionId: config.sessionId,
            channels: captureChannels,
          });
          logger.info({ sessionId: config.sessionId }, 'Capture session started');
        } catch (captureError) {
          const msg = captureError instanceof Error ? captureError.message : String(captureError);
          const stack = captureError instanceof Error ? captureError.stack : undefined;
          logger.error({ err: captureError, message: msg, stack }, 'CaptureClient.startSession failed');
          throw captureError;
        }

        // Manually emit recording:started immediately (matches Python behavior, doesn't wait for SDK event)
        logger.info({ sessionId: config.sessionId }, 'Emitting recording:started event to renderer');
        sendRecorderEvent({
          event: 'recording:started',
          data: { sessionId: config.sessionId },
        });
        logger.info({ sessionId: config.sessionId }, 'recording:started event emitted');

        return {
          success: true,
          sessionId: config.sessionId,
          micWsConnectionId: wsConnectionIds?.micWsId || undefined,
          sysAudioWsConnectionId: wsConnectionIds?.sysAudioWsId || undefined,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error({ err: error, errorMessage, errorStack }, 'Failed to start recording');
        await cleanupTranscriptWebSockets();
        cleanupCapture();
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  ipcMain.handle(
    'recorder-stop-recording',
    async (): Promise<{ success: boolean; error?: string }> => {
      logger.info('Stopping recording');

      try {
        if (captureClient) {
          removeCaptureEventListeners();

          await captureClient.stopSession();
          logger.info('Capture session stopped');

          await captureClient.shutdown();
          logger.info('CaptureClient shutdown complete');
          captureClient = null;

          // Manually emit recording:stopped immediately (ensures UI updates without waiting for SDK events)
          sendRecorderEvent({
            event: 'recording:stopped',
            data: {},
          });

          // Manually emit upload:complete since we've already shutdown the client
          // (the SDK event listener was removed before upload could complete)
          sendRecorderEvent({
            event: 'upload:complete',
            data: {},
          });
        } else {
          logger.warn('No active capture client to stop');
        }

        await cleanupTranscriptWebSockets();

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Failed to stop recording');
        await cleanupTranscriptWebSockets();
        cleanupCapture();
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    'recorder-pause-tracks',
    async (_event, tracks: string[]): Promise<void> => {
      if (captureClient) {
        await captureClient.pauseTracks(tracks as ('mic' | 'system_audio' | 'screen')[]);
      }
    }
  );

  ipcMain.handle(
    'recorder-resume-tracks',
    async (_event, tracks: string[]): Promise<void> => {
      if (captureClient) {
        await captureClient.resumeTracks(tracks as ('mic' | 'system_audio' | 'screen')[]);
      }
    }
  );

  ipcMain.handle(
    'recorder-list-channels',
    async (_event, sessionToken: string, apiUrl?: string): Promise<Channel[]> => {
      logger.info('recorder-list-channels IPC handler called');
      
      // Reuse existing captureClient to prevent "Another recorder instance" error
      if (!captureClient) {
        logger.info('Creating CaptureClient for listing channels');
        ensureVideoDBPatched();
        captureClient = new CaptureClient({
          sessionToken,
          ...(apiUrl && { apiUrl }),
        });
        
        // Set up minimal error listener immediately (required for SDK to function properly)
        captureClient.on('error', (error: unknown) => {
          logger.error({ error }, 'CaptureClient error during channel listing');
        });
        
        logger.info('CaptureClient created, calling listChannels...');
      } else {
        logger.info('Reusing existing CaptureClient for listing channels');
      }

      try {
        logger.info('Calling captureClient.listChannels()...');
        
        const listChannelsWithTimeout = async (timeoutMs: number = 30000) => {
          return Promise.race([
            captureClient!.listChannels(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`listChannels timed out after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        };
        
        const channels = await listChannelsWithTimeout(30000);
        const allChannels = channels.all();
        logger.info({ channelCount: allChannels.length, channels: allChannels }, 'listChannels returned');
        return allChannels.map((ch) => ({
          channelId: ch.id,
          type: ch.type as 'audio' | 'video',
          name: ch.name,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = errorMessage.includes('exited') ? errorMessage.match(/\d+/)?.[0] : undefined;

        logger.error(
          { error, errorMessage, errorCode },
          'Failed to list channels - this may indicate a binary execution issue'
        );

        if (captureClient) {
          try {
            await captureClient.shutdown();
          } catch (e) {
            // Ignore shutdown errors during cleanup
          }
          captureClient = null;
        }

        const detailedError = new Error(
          `Failed to list recording channels: ${errorMessage}` +
            (errorCode === '101' ? '. This may be a binary compatibility issue - check if the recorder binary matches your system architecture.' : '')
        );
        throw detailedError;
      }
    }
  );
}

// Cleanup capture client for synchronous cleanup (doesn't wait for shutdown)
function cleanupCapture(): void {
  if (captureClient) {
    removeCaptureEventListeners();

    const client = captureClient;
    captureClient = null;

    client.shutdown().catch((error) => {
      logger.warn({ error }, 'Error shutting down CaptureClient during cleanup');
    });
  }
}

// Async cleanup that waits for shutdown to complete (for tests or external cleanup)
export async function cleanupCaptureAsync(): Promise<void> {
  if (captureClient) {
    removeCaptureEventListeners();

    const client = captureClient;
    captureClient = null;

    try {
      await client.shutdown();
      logger.info('CaptureClient shutdown completed');
    } catch (error) {
      logger.warn({ error }, 'Error during async CaptureClient shutdown');
    }
  }
}

export async function shutdownCaptureClient(): Promise<void> {
  await cleanupTranscriptWebSockets();

  if (captureClient) {
    logger.info('Shutting down CaptureClient before app quit');

    removeCaptureEventListeners();

    const client = captureClient;
    captureClient = null;

    try {
      await client.stopSession();
    } catch (error) {
      logger.warn({ error }, 'Error stopping capture session during shutdown');
    }
    try {
      await client.shutdown();
    } catch (error) {
      logger.warn({ error }, 'Error shutting down CaptureClient during shutdown');
    }
    logger.info('CaptureClient shutdown complete');
  }
}

export function isCaptureActive(): boolean {
  return captureClient !== null;
}
