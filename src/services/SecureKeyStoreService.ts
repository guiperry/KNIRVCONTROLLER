/**
 * Secure Key Store Service
 * Stores encrypted secrets (mnemonics) in RxDB `settings` collection using a master key from env
 */

import crypto from 'crypto';
import { rxdbService } from './RxDBService';

const MASTER_KEY_ENV = 'KNIRV_MASTER_KEY';

function getMasterKey(): Buffer {
  const k = process.env[MASTER_KEY_ENV];
  if (!k) throw new Error(`${MASTER_KEY_ENV} missing; set a strong master key to enable secure key storage`);
  // Derive 32-byte key via SHA256
  return crypto.createHash('sha256').update(k).digest();
}

function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return payload;
}

function decrypt(payloadB64: string): string {
  const key = getMasterKey();
  const payload = Buffer.from(payloadB64, 'base64');
  const iv = payload.slice(0, 12);
  const tag = payload.slice(12, 28);
  const encrypted = payload.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export class SecureKeyStoreService {
  // Store mnemonic under settings collection with id `secret_${userId}` and key 'mnemonic'
  async storeMnemonic(userId: string, mnemonic: string): Promise<void> {
    if (!userId) throw new Error('userId required');
    if (!mnemonic) throw new Error('mnemonic required');

    if (!rxdbService.isDatabaseInitialized()) await rxdbService.initialize();
    const db = rxdbService.getDatabase();

    const encrypted = encrypt(mnemonic);

    await db.settings.upsert({
      id: `secret_${userId}`,
      type: 'settings',
      key: `mnemonic_${userId}`,
      value: encrypted,
      timestamp: Date.now()
    });
  }

  async getMnemonic(userId: string): Promise<string | null> {
    if (!userId) throw new Error('userId required');

    if (!rxdbService.isDatabaseInitialized()) await rxdbService.initialize();
    const db = rxdbService.getDatabase();

    const doc = await db.settings.findOne({ selector: { id: `secret_${userId}` } }).exec();
    if (!doc || !doc.value) return null;

    try {
      const decrypted = decrypt(doc.value as string);
      return decrypted;
    } catch (err) {
      console.error('Failed to decrypt mnemonic:', err);
      return null;
    }
  }

  async clearMnemonic(userId: string): Promise<void> {
    if (!userId) throw new Error('userId required');
    if (!rxdbService.isDatabaseInitialized()) await rxdbService.initialize();
    const db = rxdbService.getDatabase();

    const doc = await db.settings.findOne({ selector: { id: `secret_${userId}` } }).exec();
    if (doc) await doc.remove();
  }
}

export const secureKeyStoreService = new SecureKeyStoreService();
