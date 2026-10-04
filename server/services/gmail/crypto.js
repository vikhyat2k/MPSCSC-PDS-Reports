/**
 * Google OAuth 2.0 Token Security Utility
 * Encrypts and decrypts OAuth refresh tokens using AES-256-GCM.
 * MPSCSC Supervision Portal
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Derives a consistent 32-byte encryption key from environment variable or persisted secret
 */
function getMasterKey() {
  let secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    const storageDir = path.join(__dirname, '../../../storage');
    const keyFile = path.join(storageDir, '.token_secret.key');
    if (fs.existsSync(keyFile)) {
      secret = fs.readFileSync(keyFile, 'utf8').trim();
    } else {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      secret = crypto.randomBytes(32).toString('hex');
      try {
        fs.writeFileSync(keyFile, secret, { mode: 0o600 });
      } catch (err) {
        console.warn('⚠️ Could not write .token_secret.key to disk:', err.message);
      }
    }
  }
  return crypto.scryptSync(secret, 'mpscsc-betul-supervision-salt', 32);
}

/**
 * Encrypts plain text (e.g. refresh token) using AES-256-GCM
 * @param {string} text Plain text to encrypt
 * @returns {string} Hex-encoded IV + AuthTag + Ciphertext
 */
function encryptToken(text) {
  if (!text) return null;
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts hex-encoded string back to plain text
 * @param {string} encryptedPayload Encrypted string in iv:tag:cipher format
 * @returns {string} Decrypted plain text
 */
function decryptToken(encryptedPayload) {
  if (!encryptedPayload) return null;
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('❌ Token decryption failed:', err.message);
    return null;
  }
}

module.exports = {
  encryptToken,
  decryptToken
};
