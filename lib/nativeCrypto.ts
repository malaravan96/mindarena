import * as ExpoCrypto from 'expo-crypto';

export function getRandomBytes(length: number): Uint8Array {
  // expo-crypto.getRandomBytes works across all Expo runtimes (Expo Go + dev builds)
  return ExpoCrypto.getRandomBytes(length);
}

function toHex(byte: number) {
  return byte.toString(16).padStart(2, '0');
}

export function randomUuid(): string {
  if (typeof ExpoCrypto.randomUUID === 'function') {
    return ExpoCrypto.randomUUID();
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
