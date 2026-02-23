import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';

const ENVELOPE_PREFIX = 'e2ee:v1';
const PRIVATE_KEY_PREFIX = 'dm_e2ee_private_key_v1';
const CONTEXT_PREFIX = 'mindarena-dm-e2ee-v1';
const PEER_NOT_READY_ERROR = 'Peer is not ready for encrypted chat yet.';

type LocalKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

const localKeyCache = new Map<string, LocalKeyPair>();
const localKeyPromiseCache = new Map<string, Promise<LocalKeyPair>>();
const peerPublicKeyCache = new Map<string, Uint8Array>();
const publishedKeyForUser = new Set<string>();
let secureStoreAvailable: boolean | null = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error('Invalid hex input');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('Invalid hex input');
    }
    out[i] = byte;
  }
  return out;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function getEnvelopeParts(envelope: string) {
  if (!envelope.startsWith(`${ENVELOPE_PREFIX}:`)) {
    return null;
  }
  const [, nonceHex = '', cipherHex = ''] = envelope.split(':');
  if (!nonceHex || !cipherHex) return null;
  return { nonceHex, cipherHex };
}

async function isSecureStoreAvailable() {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  secureStoreAvailable = await SecureStore.isAvailableAsync();
  return secureStoreAvailable;
}

async function getRandomBytes(length: number) {
  if (typeof Crypto.getRandomBytes === 'function') {
    return Crypto.getRandomBytes(length);
  }
  return Crypto.getRandomBytesAsync(length);
}

function secureKeyForUser(userId: string) {
  const normalizedUserId = userId.trim().replace(/[^A-Za-z0-9._-]/g, '_');
  if (!normalizedUserId) {
    throw new Error('Invalid user id for local encryption key');
  }
  return `${PRIVATE_KEY_PREFIX}_${normalizedUserId}`;
}

async function publishPublicKey(userId: string, publicKeyHex: string) {
  if (publishedKeyForUser.has(userId)) return;

  const { error } = await supabase
    .from('dm_user_keys')
    .upsert({ user_id: userId, public_key: publicKeyHex }, { onConflict: 'user_id' });

  if (error) {
    throw new Error(
      `E2EE key publish failed: ${error.message}. Run supabase/dm-e2ee.sql to create dm_user_keys.`,
    );
  }

  publishedKeyForUser.add(userId);
  peerPublicKeyCache.set(userId, fromHex(publicKeyHex));
}

async function loadStoredLocalKey(userId: string) {
  const canUseSecureStore = await isSecureStoreAvailable();
  if (!canUseSecureStore) return null;

  const raw = await SecureStore.getItemAsync(secureKeyForUser(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { secretKey: string; publicKey: string };
    const secretKey = fromHex(parsed.secretKey);
    const publicKey = fromHex(parsed.publicKey);
    if (secretKey.length !== nacl.box.secretKeyLength || publicKey.length !== nacl.box.publicKeyLength) {
      return null;
    }
    return { secretKey, publicKey };
  } catch {
    return null;
  }
}

async function persistLocalKey(userId: string, pair: LocalKeyPair) {
  const canUseSecureStore = await isSecureStoreAvailable();
  if (!canUseSecureStore) return;
  await SecureStore.setItemAsync(
    secureKeyForUser(userId),
    JSON.stringify({
      secretKey: toHex(pair.secretKey),
      publicKey: toHex(pair.publicKey),
    }),
  );
}

async function ensureLocalKeyPair(userId: string): Promise<LocalKeyPair> {
  const cached = localKeyCache.get(userId);
  if (cached) return cached;

  const existingPromise = localKeyPromiseCache.get(userId);
  if (existingPromise) return existingPromise;

  const createPromise = (async () => {
    const stored = await loadStoredLocalKey(userId);
    if (stored) {
      localKeyCache.set(userId, stored);
      await publishPublicKey(userId, toHex(stored.publicKey));
      return stored;
    }

    const seed = await getRandomBytes(nacl.box.secretKeyLength);
    const seed32 = seed.slice(0, nacl.box.secretKeyLength);
    const pair = nacl.box.keyPair.fromSecretKey(seed32);
    const next = { publicKey: pair.publicKey, secretKey: pair.secretKey };
    localKeyCache.set(userId, next);
    await persistLocalKey(userId, next);
    await publishPublicKey(userId, toHex(next.publicKey));
    return next;
  })();

  localKeyPromiseCache.set(userId, createPromise);
  try {
    return await createPromise;
  } finally {
    if (localKeyPromiseCache.get(userId) === createPromise) {
      localKeyPromiseCache.delete(userId);
    }
  }
}

async function getPublicKey(userId: string, options?: { forceRefresh?: boolean }): Promise<Uint8Array> {
  if (!options?.forceRefresh) {
    const cached = peerPublicKeyCache.get(userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('dm_user_keys')
    .select('public_key')
    .eq('user_id', userId)
    .maybeSingle<{ public_key: string }>();

  if (error || !data?.public_key) {
    throw new Error(PEER_NOT_READY_ERROR);
  }

  const key = fromHex(data.public_key);
  if (key.length !== nacl.box.publicKeyLength) {
    throw new Error('Peer encryption key is invalid.');
  }
  peerPublicKeyCache.set(userId, key);
  return key;
}

async function deriveConversationKey(
  conversationId: string,
  userId: string,
  peerId: string,
  options?: { forceRefreshPeerKey?: boolean },
) {
  const me = await ensureLocalKeyPair(userId);
  const peerPublicKey = await getPublicKey(peerId, {
    forceRefresh: options?.forceRefreshPeerKey,
  });
  const shared = nacl.box.before(peerPublicKey, me.secretKey);
  const context = encoder.encode(`${CONTEXT_PREFIX}:${conversationId}`);
  const material = concatBytes([shared, context]);
  return nacl.hash(material).slice(0, nacl.secretbox.keyLength);
}

export function isEncryptedEnvelope(value: string) {
  return value.startsWith(`${ENVELOPE_PREFIX}:`);
}

export function isPeerE2eeNotReadyError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === PEER_NOT_READY_ERROR || error.message.includes(PEER_NOT_READY_ERROR))
  );
}

export async function ensureDmE2eeReady(userId: string) {
  await ensureLocalKeyPair(userId);
}

export async function encryptDmMessageBody(params: {
  conversationId: string;
  userId: string;
  peerId: string;
  body: string;
  forceRefreshPeerKey?: boolean;
}) {
  const key = await deriveConversationKey(params.conversationId, params.userId, params.peerId, {
    forceRefreshPeerKey: params.forceRefreshPeerKey,
  });
  const nonce = await getRandomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(encoder.encode(params.body), nonce, key);
  return `${ENVELOPE_PREFIX}:${toHex(nonce)}:${toHex(cipher)}`;
}

export async function decryptDmMessageBody(params: {
  conversationId: string;
  userId: string;
  peerId: string;
  body: string;
}) {
  const envelope = getEnvelopeParts(params.body);
  if (!envelope) return params.body;

  const nonce = fromHex(envelope.nonceHex);
  const cipher = fromHex(envelope.cipherHex);
  const decryptWith = async (forceRefreshPeerKey: boolean) => {
    const key = await deriveConversationKey(params.conversationId, params.userId, params.peerId, {
      forceRefreshPeerKey,
    });
    return nacl.secretbox.open(cipher, nonce, key);
  };

  let plain = await decryptWith(false);
  if (!plain) {
    plain = await decryptWith(true);
  }
  if (!plain) {
    throw new Error('Failed to decrypt message');
  }
  return decoder.decode(plain);
}

export async function encryptDmCallPayload(params: {
  conversationId: string;
  userId: string;
  peerId: string;
  payload: Record<string, unknown>;
  forceRefreshPeerKey?: boolean;
}) {
  const json = JSON.stringify(params.payload);
  const envelope = await encryptDmMessageBody({
    conversationId: params.conversationId,
    userId: params.userId,
    peerId: params.peerId,
    body: json,
    forceRefreshPeerKey: params.forceRefreshPeerKey,
  });
  return envelope;
}

export async function decryptDmCallPayload(params: {
  conversationId: string;
  userId: string;
  peerId: string;
  envelope: string;
}) {
  const json = await decryptDmMessageBody({
    conversationId: params.conversationId,
    userId: params.userId,
    peerId: params.peerId,
    body: params.envelope,
  });
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to decode call payload');
  }
}
