type CryptoWithRandomValues = {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
  randomUUID?: () => string;
};

function getCrypto(): CryptoWithRandomValues {
  const crypto = globalThis.crypto as CryptoWithRandomValues | undefined;
  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random generation is unavailable in this runtime.');
  }
  return crypto;
}

export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

function toHex(byte: number) {
  return byte.toString(16).padStart(2, '0');
}

export function randomUuid(): string {
  const crypto = getCrypto();
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, toHex);
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
