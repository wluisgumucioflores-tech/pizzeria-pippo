import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Encrypts secrets that the backend needs to be able to read back (unlike
// a password, which is only compared — see PasswordHasherService). Use case:
// cloud providers' API keys in ai_models.api_key. The key comes from
// AI_MODELS_ENCRYPTION_KEY (any string; derived to 32 bytes with
// sha256) — never hardcoded, never in the DB.
function deriveKey(): Buffer {
  const secret = process.env.AI_MODELS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('AI_MODELS_ENCRYPTION_KEY no está configurada.');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const key = deriveKey();
  const raw = Buffer.from(ciphertext, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
