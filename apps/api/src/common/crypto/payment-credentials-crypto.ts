import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

function deriveKey(secret: string): Buffer {
  const salt = 'tiptap-payments-v1';
  return scryptSync(secret, salt, KEY_LEN);
}

export function encryptCredentialsJson(secret: string | undefined, payload: object): string {
  if (!secret?.trim()) {
    throw new Error('PAYMENTS_CREDENTIALS_SECRET is required to store provider credentials');
  }
  const key = deriveKey(secret.trim());
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptCredentialsJson<T extends object>(secret: string | undefined, blob: string): T {
  if (!secret?.trim()) {
    throw new Error('PAYMENTS_CREDENTIALS_SECRET is required to decrypt provider credentials');
  }
  const raw = Buffer.from(blob, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + 16);
  const data = raw.subarray(IV_LEN + 16);
  const key = deriveKey(secret.trim());
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}

export function maskSecret(s: string | undefined, visible = 4): string {
  if (!s) {
    return '';
  }
  if (s.length <= visible) {
    return '****';
  }
  return `${'*'.repeat(Math.max(4, s.length - visible))}${s.slice(-visible)}`;
}
