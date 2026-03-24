import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Fix a path to use app.asar.unpacked instead of app.asar
 * This is needed for binary files that need to be executed
 */
export function getUnpackedPath(originalPath: string): string {
  if (!app.isPackaged) {
    return originalPath;
  }

  // Replace app.asar with app.asar.unpacked
  return originalPath.replace('app.asar', 'app.asar.unpacked');
}

/**
 * Get the path to a binary in node_modules, handling asar unpacking
 */
function getModuleRoot(moduleName: string): string {
  try {
    // Resolve from cwd to avoid relying on process.cwd() being the app root
    // This matches Node's normal module resolution behavior.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resolved = require.resolve(`${moduleName}/package.json`, { paths: [process.cwd()] });
    return path.dirname(resolved);
  } catch {
    return path.join(process.cwd(), 'node_modules', moduleName);
  }
}

export function getNodeModulesBinaryPath(moduleName: string, binaryPath: string): string {
  // In development, resolve via Node module resolution
  if (!app.isPackaged) {
    return path.join(getModuleRoot(moduleName), binaryPath);
  }

  // In production, use the unpacked path
  const resourcesPath = process.resourcesPath;
  return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', moduleName, binaryPath);
}

/**
 * Get the directory containing a binary in node_modules
 */
export function getNodeModulesBinaryDir(moduleName: string, binaryDir: string): string {
  if (!app.isPackaged) {
    return path.join(getModuleRoot(moduleName), binaryDir);
  }

  const resourcesPath = process.resourcesPath;
  return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', moduleName, binaryDir);
}

/**
 * Get the videodb capture binary path (inside VideoDBCapture.app bundle)
 */
export function getVideoDBRecorderPath(): string {
  return getNodeModulesBinaryPath('videodb', 'bin/VideoDBCapture.app/Contents/MacOS/capture');
}

/**
 * Get the videodb recorder binary directory (contains capture and librecorder.dylib)
 */
export function getVideoDBRecorderDir(): string {
  return getNodeModulesBinaryDir('videodb', 'bin/VideoDBCapture.app/Contents/MacOS');
}

/**
 * Get the videodb meet_detector binary path
 */
export function getVideoDBMeetDetectorPath(): string {
  return getNodeModulesBinaryPath('videodb', 'bin/meet_detector');
}

/**
 * Get environment variables needed for running the videodb recorder binary
 * This ensures librecorder.dylib can be found via DYLD_LIBRARY_PATH
 */
export function getVideoDBRecorderEnv(): NodeJS.ProcessEnv {
  const binDir = getVideoDBRecorderDir();
  const currentDyldPath = process.env.DYLD_LIBRARY_PATH || '';

  return {
    ...process.env,
    // Add the bin directory to DYLD_LIBRARY_PATH so librecorder.dylib can be found
    DYLD_LIBRARY_PATH: currentDyldPath ? `${binDir}:${currentDyldPath}` : binDir,
    // Also set DYLD_FALLBACK_LIBRARY_PATH as a fallback mechanism
    DYLD_FALLBACK_LIBRARY_PATH: binDir,
  };
}

/**
 * Verify that the videodb recorder binary exists and is accessible
 */
export function verifyVideoDBRecorder(): { exists: boolean; path: string; error?: string } {
  const recorderPath = getVideoDBRecorderPath();
  const binDir = getVideoDBRecorderDir();
  const dylibPath = path.join(binDir, 'librecorder.dylib');

  if (!fs.existsSync(recorderPath)) {
    return { exists: false, path: recorderPath, error: `Capture binary not found at ${recorderPath}` };
  }

  if (process.platform === 'darwin' && !fs.existsSync(dylibPath)) {
    return { exists: false, path: recorderPath, error: `librecorder.dylib not found at ${dylibPath}` };
  }

  return { exists: true, path: recorderPath };
}

/**
 * Get the user data directory for storing app-specific files
 * This is safe to use in both dev and production
 */
export function getUserDataPath(): string {
  return app.getPath('userData');
}

/**
 * Get a safe path for lock files that works in both dev and production
 */
export function getLockFilePath(filename: string): string {
  return path.join(getUserDataPath(), filename);
}
