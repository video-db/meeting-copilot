import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { AppConfig, RuntimeConfig } from '../../shared/schemas/config.schema';
import { logger } from './logger';

const CONFIG_FILENAME = 'config.json';
const RUNTIME_FILENAME = 'runtime.json';
const AUTH_CONFIG_FILENAME = 'auth_config.json';

export function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

export function getRuntimeConfigPath(): string {
  // Runtime config is in the app directory (for development) or resources (for production)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', RUNTIME_FILENAME);
  }
  return path.join(app.getAppPath(), RUNTIME_FILENAME);
}

export function getAuthConfigPath(): string {
  // Auth config is in the app directory (for auto-registration on startup)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', AUTH_CONFIG_FILENAME);
  }
  return path.join(app.getAppPath(), AUTH_CONFIG_FILENAME);
}

export function loadAppConfig(): AppConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data) as AppConfig;
    }
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to load app config');
  }
  return {};
}

export function saveAppConfig(config: AppConfig): void {
  const configPath = getConfigPath();
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.info({ configPath }, 'App config saved');
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to save app config');
    throw error;
  }
}

export function loadRuntimeConfig(): RuntimeConfig {
  const configPath = getRuntimeConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data) as RuntimeConfig;
    }
  } catch (error) {
    logger.warn({ error, configPath }, 'Failed to load runtime config, using defaults');
  }
  return {
    apiPort: 51731,
  };
}

export function loadAuthConfig(): { apiKey: string; name: string } | null {
  const configPath = getAuthConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.apiKey && config.name) {
        return config;
      }
    }
  } catch (error) {
    logger.warn({ error, configPath }, 'Failed to load auth config');
  }
  return null;
}

export function deleteAuthConfig(): void {
  const configPath = getAuthConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      logger.info({ configPath }, 'Auth config deleted');
    }
  } catch (error) {
    logger.warn({ error, configPath }, 'Failed to delete auth config');
  }
}

export function clearAppConfig(): void {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      logger.info({ configPath }, 'App config cleared');
    }
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to clear app config');
  }
}
