const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(response.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function getTargetArchName(arch) {
  if (arch === 1 || arch === 'x64') return 'x64';
  if (arch === 3 || arch === 'arm64') return 'arm64';

  if (process.arch === 'arm64') return 'arm64';
  if (process.arch === 'x64') return 'x64';

  return 'x64';
}

function getCloudflaredDownloadUrl(archName) {
  const archSuffix = archName === 'arm64' ? 'arm64' : 'amd64';
  return `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${archSuffix}.tgz`;
}

function matchesCloudflaredArch(fileOutput, archName) {
  if (archName === 'arm64') return fileOutput.includes('arm64');
  if (archName === 'x64') return fileOutput.includes('x86_64');
  return false;
}

/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  appId: 'com.videodb.meeting-copilot',
  productName: 'Meeting Copilot',
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
    'node_modules/cloudflared/bin/**',
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
      NSMicrophoneUsageDescription: 'Meeting Copilot needs microphone access to record audio.',
      NSCameraUsageDescription: 'Meeting Copilot needs camera access to record video.',
      NSScreenCaptureUsageDescription:
        'Meeting Copilot needs screen capture access to record your screen.',
    },
  },
  dmg: {
    title: 'Meeting Copilot ${version}${arch}',
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

    const cloudflaredBinDir = path.join(__dirname, 'node_modules', 'cloudflared', 'bin');
    const cloudflaredPath = path.join(cloudflaredBinDir, 'cloudflared');

    if (!fs.existsSync(cloudflaredBinDir)) {
      console.warn('Cloudflared bin directory missing:', cloudflaredBinDir);
      return;
    }

    // Clean up any leftover backups from previous builds to avoid bundling them.
    for (const entry of fs.readdirSync(cloudflaredBinDir)) {
      if (entry.startsWith('cloudflared') && entry.endsWith('.bak')) {
        fs.unlinkSync(path.join(cloudflaredBinDir, entry));
      }
    }

    let shouldDownload = true;
    if (fs.existsSync(cloudflaredPath)) {
      try {
        const fileOutput = execSync(`file "${cloudflaredPath}"`).toString();
        shouldDownload = !matchesCloudflaredArch(fileOutput, archName);
        console.log('Existing cloudflared binary type:', fileOutput.trim());
      } catch (error) {
        console.warn('Failed to inspect cloudflared binary:', error.message);
      }
    }

    if (!shouldDownload) {
      console.log('Cloudflared binary matches target arch, skipping download');
      return;
    }

    console.log('Downloading cloudflared binary for target:', archName);

    const backupPath = path.join(cloudflaredBinDir, 'cloudflared.bak');
    if (fs.existsSync(cloudflaredPath)) {
      fs.renameSync(cloudflaredPath, backupPath);
      console.log('Backed up existing cloudflared binary');
    }

    const downloadUrl = getCloudflaredDownloadUrl(archName);
    const tgzPath = path.join(cloudflaredBinDir, `cloudflared-darwin-${archName}.tgz`);

    try {
      await downloadFile(downloadUrl, tgzPath);
      console.log('Downloaded cloudflared archive:', downloadUrl);

      execSync(`tar -xzf "${tgzPath}" -C "${cloudflaredBinDir}"`, { stdio: 'inherit' });
      console.log('Extracted cloudflared binary');

      fs.unlinkSync(tgzPath);

      const fileOutput = execSync(`file "${cloudflaredPath}"`).toString();
      console.log('New cloudflared binary type:', fileOutput.trim());

      fs.chmodSync(cloudflaredPath, 0o755);

      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (error) {
      console.error('Failed to download cloudflared:', error.message);
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, cloudflaredPath);
        console.log('Restored previous cloudflared binary');
      }
      throw error;
    }
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
      const cloudflaredBinPath = path.join(unpackedPath, 'node_modules', 'cloudflared', 'bin');

      console.log('Checking videodb binaries at:', videodbBinPath);
      console.log('Checking cloudflared binaries at:', cloudflaredBinPath);

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

      const cloudflaredPath = path.join(cloudflaredBinPath, 'cloudflared');
      if (fs.existsSync(cloudflaredPath)) {
        console.log('Found cloudflared binary');

        try {
          const fileOutput = execSync(`file "${cloudflaredPath}"`).toString();
          console.log('Cloudflared binary type:', fileOutput.trim());

          fs.chmodSync(cloudflaredPath, 0o755);
          console.log('Set cloudflared binary permissions to 755');
        } catch (error) {
          console.error('Error checking cloudflared binary:', error.message);
        }
      } else {
        console.error('ERROR: cloudflared binary not found at', cloudflaredPath);
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
