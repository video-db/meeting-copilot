const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getTargetArchName(arch) {
  if (arch === 1 || arch === 'x64') return 'x64';
  if (arch === 3 || arch === 'arm64') return 'arm64';

  if (process.arch === 'arm64') return 'arm64';
  if (process.arch === 'x64') return 'x64';

  return 'x64';
}

/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  appId: 'com.videodb.call-md',
  productName: 'Call.md',
  directories: {
    output: 'release',
    buildResources: 'resources',
  },
  files: [
    'dist/**/*',
    'package.json',
    'node_modules/**/*',
    '!node_modules/*/{CHANGELOG.md,README.md,readme.md,README,readme}',
    '!node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!node_modules/.cache/**/*',
    '!**/*.{ts,tsx,map,md}',
  ],
  extraResources: [
    {
      from: 'resources/',
      to: 'resources/',
      filter: ['**/*', '!.gitkeep'],
    },
  ],
  asar: true,
  // Only unpack binary directories - simpler and more reliable
  asarUnpack: [
    'node_modules/videodb/bin/**',
    'node_modules/better-sqlite3/build/**',
  ],
  npmRebuild: true,
  nodeGypRebuild: false,
  buildDependenciesFromSource: false,
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.productivity',
    icon: 'resources/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSMicrophoneUsageDescription: 'Call.md needs microphone access to record audio.',
      NSCameraUsageDescription: 'Call.md needs camera access to record video.',
      NSScreenCaptureUsageDescription:
        'Call.md needs screen capture access to record your screen.',
    },
  },
  dmg: {
    title: 'Call.md ${version}${arch}',
    icon: 'resources/icon.icns',
    window: {
      width: 540,
      height: 380,
    },
    contents: [
      {
        x: 140,
        y: 200,
        type: 'file',
      },
      {
        x: 400,
        y: 200,
        type: 'link',
        path: '/Applications',
      },
    ],
  },
  win: {
    target: ['nsis'],
    icon: 'resources/icon.ico',
  },
  linux: {
    target: ['AppImage'],
    category: 'Office',
  },
  beforePack: async (context) => {
    const targetArch = context.arch;
    const archName = getTargetArchName(targetArch);
    console.log('Before pack - target arch:', targetArch, archName);
  },
  afterPack: async (context) => {
    const appOutDir = context.appOutDir;
    const platform = context.packager.platform.name;

    console.log('After pack:', appOutDir);
    console.log('Platform:', platform);

    if (platform === 'mac') {
      const appName = context.packager.appInfo.productFilename;
      const resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
      const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');

      const videodbAppBundle = path.join(
        unpackedPath, 'node_modules', 'videodb', 'bin', 'VideoDBCapture.app'
      );
      const macosDir = path.join(videodbAppBundle, 'Contents', 'MacOS');
      const infoPlistPath = path.join(videodbAppBundle, 'Contents', 'Info.plist');

      console.log('Checking videodb binaries at:', macosDir);

      const recorderPath = path.join(macosDir, 'capture');
      const librecorderPath = path.join(macosDir, 'librecorder.dylib');

      if (fs.existsSync(recorderPath)) {
        console.log('Found capture binary');

        try {
          const fileOutput = execSync(`file "${recorderPath}"`).toString();
          console.log('Capture binary type:', fileOutput.trim());

          const targetArch = context.arch;
          const isArm64 = targetArch === 'arm64' || targetArch === 3; // arch 3 = arm64 in electron-builder
          const isX64 = targetArch === 'x64' || targetArch === 1; // arch 1 = x64 in electron-builder

          if (isArm64 && fileOutput.includes('x86_64') && !fileOutput.includes('arm64')) {
            console.warn('WARNING: Capture binary is x86_64 but building for arm64!');
          } else if (isX64 && fileOutput.includes('arm64') && !fileOutput.includes('x86_64')) {
            console.warn('WARNING: Capture binary is arm64 but building for x64!');
          }

          fs.chmodSync(recorderPath, 0o755);
          console.log('Set capture binary permissions to 755');
        } catch (error) {
          console.error('Error checking capture binary:', error.message);
        }
      } else {
        console.error('ERROR: Capture binary not found at', recorderPath);
      }

      if (fs.existsSync(librecorderPath)) {
        fs.chmodSync(librecorderPath, 0o644);
        console.log('Set librecorder.dylib permissions to 644');
      } else {
        console.error('ERROR: librecorder.dylib not found at', librecorderPath);
      }

      // Patch Info.plist with mic/camera usage descriptions
      if (fs.existsSync(infoPlistPath)) {
        try {
          let plistContent = fs.readFileSync(infoPlistPath, 'utf8');
          if (!plistContent.includes('NSMicrophoneUsageDescription')) {
            plistContent = plistContent.replace(
              '</dict>',
              '    <key>NSMicrophoneUsageDescription</key>\n' +
              '    <string>VideoDB Capture needs microphone access to record audio.</string>\n' +
              '    <key>NSCameraUsageDescription</key>\n' +
              '    <string>VideoDB Capture needs camera access to record video.</string>\n' +
              '</dict>'
            );
            fs.writeFileSync(infoPlistPath, plistContent);
            console.log('Patched VideoDBCapture Info.plist with mic/camera usage descriptions');
          }
        } catch (err) {
          console.warn('Failed to patch Info.plist:', err.message);
        }
      }

      // Re-codesign the .app bundle inside-out so macOS TCC recognises it
      // after electron-builder packing (hardened runtime invalidates signatures)
      try {
        if (fs.existsSync(librecorderPath)) {
          execSync(`codesign --force --sign - "${librecorderPath}"`);
          console.log('Codesigned librecorder.dylib');
        }
        if (fs.existsSync(recorderPath)) {
          execSync(`codesign --force --sign - "${recorderPath}"`);
          console.log('Codesigned capture binary');
        }
        if (fs.existsSync(videodbAppBundle)) {
          execSync(`codesign --force --sign - "${videodbAppBundle}"`);
          console.log('Codesigned VideoDBCapture.app bundle');
        }
      } catch (error) {
        console.warn('Codesign failed (mic/screen permissions may not work):', error.message);
      }

      const betterSqlitePath = path.join(
        unpackedPath,
        'node_modules',
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node'
      );
      if (fs.existsSync(betterSqlitePath)) {
        console.log('Found better-sqlite3 native module');
        try {
          execSync(`codesign --force --sign - "${betterSqlitePath}"`);
          console.log('Codesigned better_sqlite3.node');
        } catch (error) {
          console.warn('Failed to codesign better_sqlite3.node:', error.message);
        }
      } else {
        console.warn('WARNING: better-sqlite3 native module not found');
      }
    }
  },
};

module.exports = config;
