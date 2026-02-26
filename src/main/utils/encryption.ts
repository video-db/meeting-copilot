import crypto from 'crypto';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { logger } from '../lib/logger';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;
const KEY_FILE_NAME = '.mcp-encryption-key';

let encryptionKey: Buffer | null = null;

/**
 * Gets the path to the encryption key file
 */
function getKeyPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, KEY_FILE_NAME);
}

/**
 * Generates a new encryption key and saves it to disk
 */
function generateKey(): Buffer {
  const key = crypto.randomBytes(KEY_LENGTH);
  const keyPath = getKeyPath();

  // Write key with restricted permissions
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  logger.info('Generated new MCP encryption key');

  return key;
}

/**
 * Loads the encryption key from disk, generating one if it doesn't exist
 */
function loadKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey;
  }

  const keyPath = getKeyPath();

  try {
    if (fs.existsSync(keyPath)) {
      const keyHex = fs.readFileSync(keyPath, 'utf-8');
      encryptionKey = Buffer.from(keyHex, 'hex');

      if (encryptionKey.length !== KEY_LENGTH) {
        logger.warn('Invalid encryption key length, regenerating');
        encryptionKey = generateKey();
      }
    } else {
      encryptionKey = generateKey();
    }
  } catch (error) {
    logger.error({ error }, 'Failed to load encryption key, generating new one');
    encryptionKey = generateKey();
  }

  return encryptionKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded ciphertext with IV and auth tag
 */
export function encrypt(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypts a ciphertext string encrypted with encrypt()
 * @param ciphertext - Base64-encoded ciphertext with IV and auth tag
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
  const key = loadKey();
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract IV, authTag, and ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Encrypts a credentials object (for env vars or headers)
 * @param creds - Record of credential key-value pairs
 * @returns Encrypted JSON string
 */
export function encryptCredentials(creds: Record<string, string>): string {
  const json = JSON.stringify(creds);
  return encrypt(json);
}

/**
 * Decrypts credentials encrypted with encryptCredentials()
 * @param encrypted - Encrypted credentials string
 * @returns Decrypted credentials object
 */
export function decryptCredentials(encrypted: string): Record<string, string> {
  try {
    const json = decrypt(encrypted);
    return JSON.parse(json);
  } catch (error) {
    logger.error({ error }, 'Failed to decrypt credentials');
    return {};
  }
}

/**
 * Tests if encryption/decryption is working properly
 * @returns true if working, false otherwise
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-encryption-' + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return decrypted === testData;
  } catch (error) {
    logger.error({ error }, 'Encryption test failed');
    return false;
  }
}

/**
 * Resets the encryption key (for testing purposes)
 */
export function resetEncryptionKey(): void {
  encryptionKey = null;
  const keyPath = getKeyPath();
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
  }
}
