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
    const { conversation_id, callee_id, caller_name, mode } = await req.json();
    if (!conversation_id || !callee_id || !caller_name || !mode) {
      return new Response(JSON.stringify({ error: 'conversation_id, callee_id, caller_name and mode are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const safeMode = mode === 'video' ? 'video' : 'audio';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', callee_id);

    const pushTokens = (tokens ?? []).map((t) => t.expo_push_token).filter(Boolean);
    if (!pushTokens.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await sendExpoPush(
      pushTokens.map((token) => ({
        to: token,
        title: safeMode === 'video' ? 'Incoming video call' : 'Incoming audio call',
        body: `${caller_name} is calling you`,
        sound: 'default',
        priority: 'high',
        data: {
          type: 'dm',
          conversation_id,
          event: 'dm-call',
          mode: safeMode,
        },
      })),
    );

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
