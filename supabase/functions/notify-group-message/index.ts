/**
 * Supabase Edge Function: notify-group-message
 *
 * Triggered via Database Webhook after INSERT on public.group_messages.
 * Fetches all member push tokens (except the sender) and batch-sends
 * push notifications via the Expo push API.
 *
 * Configure the webhook in Supabase Dashboard:
 *   Table: group_messages  Event: INSERT
 *   URL: https://<project>.supabase.co/functions/v1/notify-group-message
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body?.record;
    if (!record?.id || !record?.group_id || !record?.sender_id) {
      return new Response('Missing required fields', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get group info
    const { data: group } = await supabase
      .from('group_conversations')
      .select('name')
      .eq('id', record.group_id)
      .maybeSingle<{ name: string }>();

    // Get sender profile
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', record.sender_id)
      .maybeSingle<{ display_name: string | null; username: string | null }>();

    const senderName = sender?.display_name || sender?.username || 'Someone';
    const groupName = group?.name ?? 'Group';

    // Get all member user IDs except sender
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', record.group_id)
      .neq('user_id', record.sender_id);

    if (!members?.length) {
      return new Response('No members to notify', { status: 200 });
    }

    const memberIds = members.map((m) => m.user_id);

    // Get push tokens for those members
    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .in('user_id', memberIds);

    if (!tokens?.length) {
      return new Response('No push tokens', { status: 200 });
    }

    const messageBody =
      record.message_type && record.message_type !== 'text'
        ? `[${record.message_type}]`
        : (record.body ?? '').slice(0, 100);

    // Batch send
    const notifications = tokens.map((t) => ({
      to: t.expo_push_token,
      title: `${groupName} · ${senderName}`,
      body: messageBody,
      data: { type: 'group', group_id: record.group_id },
      sound: 'default',
    }));

    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('notify-group-message error:', err);
    return new Response('Internal error', { status: 500 });
  }
});
