/**
 * DM attachment helpers for Supabase Storage.
 * Storage bucket: dm-attachments (private, 50MB limit)
 * Path pattern: {conversationId}/{type}/{senderId}/{messageId}.{ext}
 *
 * NOTE: Media files are NOT E2EE encrypted. They are protected by
 * signed URLs (short-lived) combined with RLS on the storage bucket.
 * Only the text `body` field is E2EE encrypted.
 */

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/dm';
import type { DmMessage, DmMessageType } from '@/lib/types';

const BUCKET = 'dm-attachments';
const SIGNED_URL_TTL = 3600; // 1 hour

// In-memory signed URL cache: path → { url, expiresAt }
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function ext(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
  };
  return map[mimeType] ?? 'bin';
}

export async function getDmAttachmentUrl(path: string, expiresIn = SIGNED_URL_TTL): Promise<string> {
  const cached = urlCache.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) throw error ?? new Error('Failed to get signed URL');

  urlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return data.signedUrl;
}

interface UploadParams {
  conversationId: string;
  messageId: string;
  type: 'image' | 'voice' | 'video' | 'file';
  senderId: string;
  uri: string;
  mimeType: string;
  filename?: string;
}

export async function uploadDmAttachment(params: UploadParams): Promise<string> {
  const { conversationId, messageId, type, senderId, uri, mimeType, filename } = params;
  const extension = filename?.split('.').pop() ?? ext(mimeType);
  const storagePath = `${conversationId}/${type}/${senderId}/${messageId}.${extension}`;

  // Fetch the file as a blob
  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;
  return storagePath;
}

export async function sendImageMessage(
  conversationId: string,
  uri: string,
  mimeType: string,
  width?: number,
  height?: number,
): Promise<DmMessage> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const messageId = crypto.randomUUID();
  const storagePath = await uploadDmAttachment({
    conversationId,
    messageId,
    type: 'image',
    senderId: uid,
    uri,
    mimeType,
  });

  const { data, error } = await supabase
    .from('dm_messages')
    .insert({
      id: messageId,
      conversation_id: conversationId,
      sender_id: uid,
      body: '',
      status: 'sent',
      message_type: 'image',
      attachment_url: storagePath,
      attachment_mime: mimeType,
      attachment_width: width ?? null,
      attachment_height: height ?? null,
    })
    .select('id, conversation_id, sender_id, body, created_at, status, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at')
    .maybeSingle<DmMessage>();

  if (error || !data) throw error ?? new Error('Image message insert failed');

  await supabase
    .from('dm_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', conversationId);

  // Resolve to signed URL for immediate rendering
  try {
    const signedUrl = await getDmAttachmentUrl(storagePath);
    return { ...data, attachment_url: signedUrl };
  } catch {
    return data;
  }
}

export async function sendVoiceMessage(
  conversationId: string,
  uri: string,
  durationSeconds: number,
): Promise<DmMessage> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const messageId = crypto.randomUUID();
  const storagePath = await uploadDmAttachment({
    conversationId,
    messageId,
    type: 'voice',
    senderId: uid,
    uri,
    mimeType: 'audio/m4a',
  });

  const { data, error } = await supabase
    .from('dm_messages')
    .insert({
      id: messageId,
      conversation_id: conversationId,
      sender_id: uid,
      body: '',
      status: 'sent',
      message_type: 'voice',
      attachment_url: storagePath,
      attachment_mime: 'audio/m4a',
      attachment_duration: durationSeconds,
    })
    .select('id, conversation_id, sender_id, body, created_at, status, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at')
    .maybeSingle<DmMessage>();

  if (error || !data) throw error ?? new Error('Voice message insert failed');

  await supabase
    .from('dm_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', conversationId);

  try {
    const signedUrl = await getDmAttachmentUrl(storagePath);
    return { ...data, attachment_url: signedUrl };
  } catch {
    return data;
  }
}

export async function sendFileMessage(
  conversationId: string,
  uri: string,
  filename: string,
  mimeType: string,
  size: number,
): Promise<DmMessage> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const messageId = crypto.randomUUID();
  const storagePath = await uploadDmAttachment({
    conversationId,
    messageId,
    type: 'file',
    senderId: uid,
    uri,
    mimeType,
    filename,
  });

  const { data, error } = await supabase
    .from('dm_messages')
    .insert({
      id: messageId,
      conversation_id: conversationId,
      sender_id: uid,
      body: filename,
      status: 'sent',
      message_type: 'file',
      attachment_url: storagePath,
      attachment_mime: mimeType,
      attachment_size: size,
    })
    .select('id, conversation_id, sender_id, body, created_at, status, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at')
    .maybeSingle<DmMessage>();

  if (error || !data) throw error ?? new Error('File message insert failed');

  await supabase
    .from('dm_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', conversationId);

  try {
    const signedUrl = await getDmAttachmentUrl(storagePath);
    return { ...data, attachment_url: signedUrl };
  } catch {
    return data;
  }
}

/** Resolve storage paths to signed URLs for a batch of messages. */
export async function resolveAttachmentUrls(messages: DmMessage[]): Promise<DmMessage[]> {
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.attachment_url) return msg;
      // Already a full URL (https://...)
      if (msg.attachment_url.startsWith('http')) return msg;
      try {
        const signedUrl = await getDmAttachmentUrl(msg.attachment_url);
        return { ...msg, attachment_url: signedUrl };
      } catch {
        return msg;
      }
    }),
  );
}
