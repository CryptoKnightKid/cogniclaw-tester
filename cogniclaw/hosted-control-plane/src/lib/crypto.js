const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function normalizeEncryptionKey(rawKey) {
  const keyMaterial = Buffer.from(String(rawKey || ''), 'utf8');
  if (keyMaterial.length >= 32) {
    return keyMaterial.subarray(0, 32);
  }
  const hash = crypto.createHash('sha256');
  hash.update(keyMaterial);
  return hash.digest();
}

function encryptText(plainText, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', normalizeEncryptionKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    algo: 'aes-256-gcm'
  };
}

function decryptText(payload, key) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    normalizeEncryptionKey(key),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

module.exports = {
  hashPassword,
  verifyPassword,
  encryptText,
  decryptText
};