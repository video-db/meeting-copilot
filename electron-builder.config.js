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
  appId: 'com.videodb.notter',
  productName: 'Notter',
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
      NSMicrophoneUsageDescription: 'Notter needs microphone access to record audio.',
      NSCameraUsageDescription: 'Notter needs camera access to record video.',
      NSScreenCaptureUsageDescription:
        'Notter needs screen capture access to record your screen.',
    },
  },
  dmg: {
    title: 'Notter ${version}${arch}',
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

      const videodbBinPath = path.join(unpackedPath, 'node_modules', 'videodb', 'bin');

      console.log('Checking videodb binaries at:', videodbBinPath);

      const recorderPath = path.join(videodbBinPath, 'recorder');
      const librecorderPath = path.join(videodbBinPath, 'librecorder.dylib');

      if (fs.existsSync(recorderPath)) {
        console.log('Found recorder binary');

        try {
          const fileOutput = execSync(`file "${recorderPath}"`).toString();
          console.log('Recorder binary type:', fileOutput.trim());

          const targetArch = context.arch;
          const isArm64 = targetArch === 'arm64' || targetArch === 3; // arch 3 = arm64 in electron-builder
          const isX64 = targetArch === 'x64' || targetArch === 1; // arch 1 = x64 in electron-builder

          if (isArm64 && fileOutput.includes('x86_64') && !fileOutput.includes('arm64')) {
            console.warn('WARNING: Recorder binary is x86_64 but building for arm64!');
            console.warn('The binary will run under Rosetta 2, which may cause issues.');
            console.warn('Consider requesting arm64 binaries from the videodb package maintainers.');
          } else if (isX64 && fileOutput.includes('arm64') && !fileOutput.includes('x86_64')) {
            console.warn('WARNING: Recorder binary is arm64 but building for x64!');
            console.warn('This may cause compatibility issues.');
          }

          fs.chmodSync(recorderPath, 0o755);
          console.log('Set recorder binary permissions to 755');
        } catch (error) {
          console.error('Error checking recorder binary:', error.message);
        }
      } else {
        console.error('ERROR: Recorder binary not found at', recorderPath);
      }

      if (fs.existsSync(librecorderPath)) {
        console.log('Found librecorder.dylib');
        fs.chmodSync(librecorderPath, 0o644);
        console.log('Set librecorder.dylib permissions to 644');
      } else {
        console.error('ERROR: librecorder.dylib not found at', librecorderPath);
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
      } else {
        console.warn('WARNING: better-sqlite3 native module not found');
      }
    }
  },
};

module.exports = config;
