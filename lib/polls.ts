import { supabase } from '@/lib/supabase';
import type { ChatPoll, ChatPollOption } from '@/lib/types';

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createPoll(
  target: { conversationId: string } | { groupId: string },
  question: string,
  options: string[],
  isMultipleChoice = false,
  endsAt?: Date,
): Promise<{ pollId: string; messageId: string }> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  if (options.length < 2) throw new Error('A poll needs at least 2 options');

  const pollPayload: Record<string, unknown> = {
    created_by: uid,
    question,
    is_multiple_choice: isMultipleChoice,
    ends_at: endsAt?.toISOString() ?? null,
  };

  if ('conversationId' in target) {
    pollPayload.conversation_id = target.conversationId;
  } else {
    pollPayload.group_id = target.groupId;
  }

  const { data: poll, error: pollError } = await supabase
    .from('chat_polls')
    .insert(pollPayload)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (pollError || !poll) throw pollError ?? new Error('Failed to create poll');

  const optionRows = options.map((text, i) => ({
    poll_id: poll.id,
    text,
    display_order: i,
  }));

  const { error: optError } = await supabase.from('chat_poll_options').insert(optionRows);
  if (optError) throw optError;

  // Send a message of type 'poll' with body = JSON of poll_id
  const messageBody = JSON.stringify({ poll_id: poll.id });
  let messageId: string;

  if ('conversationId' in target) {
    const { data: msg, error: msgError } = await supabase
      .from('dm_messages')
      .insert({
        conversation_id: target.conversationId,
        sender_id: uid,
        body: messageBody,
        status: 'sent',
        message_type: 'poll',
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (msgError || !msg) throw msgError ?? new Error('Failed to send poll message');
    messageId = msg.id;

    await supabase
      .from('dm_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', target.conversationId);
  } else {
    const { data: msg, error: msgError } = await supabase
      .from('group_messages')
      .insert({
        group_id: target.groupId,
        sender_id: uid,
        body: messageBody,
        message_type: 'poll',
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (msgError || !msg) throw msgError ?? new Error('Failed to send poll message');
    messageId = msg.id;

    await supabase
      .from('group_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', target.groupId);
  }

  return { pollId: poll.id, messageId };
}

export async function castVote(pollId: string, optionId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase.from('chat_poll_votes').upsert(
    { poll_id: pollId, option_id: optionId, user_id: uid },
    { onConflict: 'poll_id,option_id,user_id' },
  );

  if (error) throw error;
}

export async function loadPoll(pollId: string, userId: string): Promise<ChatPoll> {
  const { data: pollRow, error: pollError } = await supabase
    .from('chat_polls')
    .select('id, question, is_multiple_choice, ends_at, created_by')
    .eq('id', pollId)
    .maybeSingle<{
      id: string;
      question: string;
      is_multiple_choice: boolean;
      ends_at: string | null;
      created_by: string;
    }>();

  if (pollError || !pollRow) throw pollError ?? new Error('Poll not found');

  const { data: optionRows, error: optError } = await supabase
    .from('chat_poll_options')
    .select('id, poll_id, text, display_order')
    .eq('poll_id', pollId)
    .order('display_order', { ascending: true });

  if (optError) throw optError;

  const options = optionRows ?? [];
  const optionIds = options.map((o: { id: string }) => o.id);

  const { data: votes } = await supabase
    .from('chat_poll_votes')
    .select('option_id, user_id')
    .eq('poll_id', pollId)
    .in('option_id', optionIds);

  const votesByOption = new Map<string, number>();
  const myVotes = new Set<string>();

  for (const vote of votes ?? []) {
    votesByOption.set(vote.option_id, (votesByOption.get(vote.option_id) ?? 0) + 1);
    if (vote.user_id === userId) myVotes.add(vote.option_id);
  }

  const pollOptions: ChatPollOption[] = options.map((o: { id: string; poll_id: string; text: string; display_order: number }) => ({
    id: o.id,
    poll_id: o.poll_id,
    text: o.text,
    display_order: o.display_order,
    vote_count: votesByOption.get(o.id) ?? 0,
    voted_by_me: myVotes.has(o.id),
  }));

  return {
    id: pollRow.id,
    question: pollRow.question,
    is_multiple_choice: pollRow.is_multiple_choice,
    ends_at: pollRow.ends_at,
    created_by: pollRow.created_by,
    options: pollOptions,
  };
}
