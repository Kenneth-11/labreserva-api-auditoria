import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// scrypt (incluido en Node): lento a propósito y con sal aleatoria por usuario.
// Formato guardado: scrypt$<sal en hex>$<hash en hex>
const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false; // formato desconocido => falla cerrado
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual); // tiempo constante
}
