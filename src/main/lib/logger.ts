import pino from 'pino';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

function getLogsDir(): string {
  try {
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    return logsDir;
  } catch {
    // App not ready yet, use temp
    return '/tmp';
  }
}

function getLogFilePath(): string {
  const logsDir = getLogsDir();
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `app-${date}.log`);
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Create file stream for logging in production
let fileStream: fs.WriteStream | null = null;

function getFileStream(): fs.WriteStream {
  if (!fileStream) {
    const logPath = getLogFilePath();
    fileStream = fs.createWriteStream(logPath, { flags: 'a' });

    // Log the log file location at startup
    console.log(`[Logger] Writing logs to: ${logPath}`);
  }
  return fileStream;
}

// Custom destination that writes to both console and file
const multiStream = {
  write(msg: string) {
    // Always write to stdout
    process.stdout.write(msg);

    // In production, also write to file
    if (!isDev) {
      try {
        getFileStream().write(msg);
      } catch (e) {
        // Ignore file write errors
      }
    }
  },
};

export const logger = pino(
  {
    level: isDev ? 'debug' : 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    base: {
      pid: process.pid,
    },
  },
  // In production, use our multi-stream; in dev, let pino-pretty handle it
  isDev ? undefined : multiStream
);

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}

/**
 * Get the path to the logs directory for the user to access
 */
export function getLogsPath(): string {
  return getLogsDir();
}

/**
 * Close the log file stream (call on app exit)
 */
export function closeLogger(): void {
  if (fileStream) {
    fileStream.end();
    fileStream = null;
  }
}
