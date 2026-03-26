/**
 * Ensures VideoDB recorder binaries work in packaged Electron apps.
 *
 * The VideoDB recorder binary creates a lock file in its own directory.
 * In a packaged .app bundle, that directory is read-only (inside asar.unpacked).
 *
 * This module:
 * 1. Copies binaries from asar.unpacked to a writable userData/bin directory
 * 2. Intercepts child_process.spawn to redirect recorder calls to the writable copy
 *
 * This approach is simpler and more robust than patching the BinaryManager prototype.
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { createChildLogger } from './logger';

const logger = createChildLogger('videodb-patch');

let spawnPatched = false;

/**
 * Ensures VideoDB binaries are in a writable location and patches spawn() to use them.
 * Call this once at app startup, before any CaptureClient usage.
 */
export function applyVideoDBPatches(): void {
  if (spawnPatched) {
    logger.debug('VideoDB patches already applied');
    return;
  }

  try {
    // Source: binaries from the unpacked asar
    // v0.2.x stores binaries inside VideoDBCapture.app/Contents/MacOS/
    // Use app.getAppPath() for reliable root path (works regardless of __dirname depth)
    const binBase = path
      .join(app.getAppPath(), 'node_modules', 'videodb', 'bin')
      .replace('app.asar', 'app.asar.unpacked');

    const srcDir = path.join(binBase, 'VideoDBCapture.app', 'Contents', 'MacOS');

    // Destination: writable userData directory
    // e.g., ~/Library/Application Support/call-md/bin
    const destDir = path.join(app.getPath('userData'), 'bin');

    logger.info({ srcDir, destDir }, 'Setting up writable binaries');

    // Create destination directory if needed
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      logger.info({ destDir }, 'Created bin directory');
    }

    // Copy binaries if source exists (won't exist in dev mode)
    if (fs.existsSync(srcDir)) {
      for (const file of fs.readdirSync(srcDir)) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);

        const srcStat = fs.statSync(src);
        if (!srcStat.isFile()) continue;

        // Only copy if file doesn't exist or size changed
        if (!fs.existsSync(dest) || fs.statSync(dest).size !== srcStat.size) {
          fs.copyFileSync(src, dest);
          fs.chmodSync(dest, 0o755);
          logger.info({ file, dest }, 'Copied binary');
        }
      }
    } else {
      logger.info({ srcDir }, 'No bundled binaries found (dev mode - skipping copy)');
    }

    // Intercept child_process.spawn to redirect recorder binary to writable copy
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cp = require('child_process');
    const origSpawn = cp.spawn;
    const binName = process.platform === 'win32' ? 'capture.exe' : 'capture';
    const writableBin = path.join(destDir, binName);

    cp.spawn = function (cmd: string, args: string[], opts: Record<string, unknown>) {
      // Intercept calls to the capture binary
      if (
        typeof cmd === 'string' &&
        cmd.includes('capture') &&
        !cmd.startsWith(destDir) &&
        fs.existsSync(writableBin)
      ) {
        // Set cwd to the bin directory so lock files are created there
        const patchedOpts = { ...opts, cwd: destDir };
        logger.debug({ original: cmd, patched: writableBin, cwd: destDir }, 'Intercepted spawn');
        return origSpawn.call(this, writableBin, args, patchedOpts);
      }
      return origSpawn.call(this, cmd, args, opts);
    };

    spawnPatched = true;
    logger.info({ writableBin }, 'spawn() patched - recorder will use writable binary');
  } catch (error) {
    logger.error({ error }, 'Failed to apply VideoDB patches');
    throw error;
  }
}

/**
 * Check if patches have been applied
 */
export function isVideoDBPatched(): boolean {
  return spawnPatched;
}
