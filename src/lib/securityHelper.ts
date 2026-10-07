/**
 * Helper de Segurança e Proteção por PIN (Local)
 *
 * A proteção é por aparelho/navegador (é um bloqueio de tela local, não criptografia dos dados do Firestore).
 * O PIN nunca é salvo em texto claro, apenas hash derivado via PBKDF2-SHA256 (100.000 iterações) com salt aleatório.
 */

const PIN_HASH_KEY = 'mf_pin_hash';
const PIN_SALT_KEY = 'mf_pin_salt';
const SECURITY_ENABLED_KEY = 'mf_security_enabled';

function bufferToHex(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPin(
  pin: string,
  existingSaltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  const enc = new TextEncoder();
  const salt = existingSaltHex
    ? hexToBuffer(existingSaltHex)
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    hashHex: bufferToHex(derivedKey),
    saltHex: bufferToHex(salt),
  };
}

export function isSecurityEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SECURITY_ENABLED_KEY) === 'true';
}

export function hasPinConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(PIN_HASH_KEY) && !!localStorage.getItem(PIN_SALT_KEY);
}

export async function savePin(pin: string): Promise<void> {
  const { hashHex, saltHex } = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, hashHex);
  localStorage.setItem(PIN_SALT_KEY, saltHex);
  localStorage.setItem(SECURITY_ENABLED_KEY, 'true');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  const storedSalt = localStorage.getItem(PIN_SALT_KEY);
  if (!storedHash || !storedSalt) return false;

  const { hashHex } = await hashPin(pin, storedSalt);
  return hashHex === storedHash;
}

export function setSecurityEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SECURITY_ENABLED_KEY, String(enabled));
}

export function clearSecurityCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(SECURITY_ENABLED_KEY);
}
