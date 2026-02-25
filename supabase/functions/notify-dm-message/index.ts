import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { sendExpoPush } from '../_shared/expo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const raw = await req.json();

    // Support both client-invoked ({ message_id }) and DB webhook ({ type, record }) formats
    const messageId: string | null = raw.record?.id ?? raw.message_id ?? null;
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'message_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // When called from a DB webhook the record is already present — avoid an extra query
    let message: { id: string; conversation_id: string; sender_id: string; body: string } | null = null;
    if (
      raw.record?.id &&
      raw.record?.conversation_id &&
      raw.record?.sender_id &&
      typeof raw.record?.body === 'string'
    ) {
      message = raw.record as { id: string; conversation_id: string; sender_id: string; body: string };
    } else {
      const { data, error: messageError } = await supabase
        .from('dm_messages')
        .select('id, conversation_id, sender_id, body')
        .eq('id', messageId)
        .maybeSingle<{ id: string; conversation_id: string; sender_id: string; body: string }>();

      if (messageError || !data) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'message-not-found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      message = data;
    }

    const { data: convo } = await supabase
      .from('dm_conversations')
      .select('user_a, user_b')
      .eq('id', message.conversation_id)
      .maybeSingle<{ user_a: string; user_b: string }>();

    if (!convo) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'conversation-not-found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientId = convo.user_a === message.sender_id ? convo.user_b : convo.user_a;

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', message.sender_id)
      .maybeSingle<{ username: string | null; display_name: string | null }>();

    const senderName = senderProfile?.display_name || senderProfile?.username || 'New message';
    const previewBody = message.body.startsWith('e2ee:v1:')
      ? 'Sent you an encrypted message'
      : message.body.slice(0, 120);

    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', recipientId);

    const pushTokens = (tokens ?? []).map((t) => t.expo_push_token).filter(Boolean);
    if (!pushTokens.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await sendExpoPush(
        pushTokens.map((token) => ({
          to: token,
          title: senderName,
          body: previewBody,
          sound: 'default',
          priority: 'high',
          data: {
            type: 'dm',
            conversation_id: message.conversation_id,
            message_id: message.id,
          },
        })),
      );
    } catch (pushError) {
      console.error('notify-dm-message push send failed', pushError);
      return new Response(JSON.stringify({ ok: false, sent: 0, reason: 'push-send-failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: pushTokens.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
