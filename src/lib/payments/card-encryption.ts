/**
 * Encrypt/decrypt card numbers at rest for rebills.
 * Uses AES-256-GCM. Key must be 32 bytes (64 hex chars). Never store CVV.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const raw = process.env.CARD_ENCRYPTION_KEY;
  if (!raw || raw.length < 64) {
    throw new Error('CARD_ENCRYPTION_KEY must be set and at least 64 hex characters (32 bytes)');
  }
  const hex = raw.slice(0, 64).replace(/[^a-fA-F0-9]/g, '');
  if (hex.length !== 64) {
    throw new Error('CARD_ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a card number. Returns base64(iv || authTag || ciphertext).
 */
export function encryptCardNumber(cardNumber: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
  const plain = Buffer.from((cardNumber || '').replace(/\s/g, ''), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a card number. Input is base64(iv || authTag || ciphertext).
 */
export function decryptCardNumber(encryptedBase64: string): string {
  const key = getKey();
  const buf = Buffer.from(encryptedBase64, 'base64');
  if (buf.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error('Invalid encrypted card data');
  }
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
