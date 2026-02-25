import { supabase } from '@/lib/supabase';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'hate_speech'
  | 'impersonation'
  | 'other';

export type ReportContextType = 'dm' | 'group' | 'profile';

export async function reportUser(
  reportedId: string,
  reason: ReportReason,
  details?: string,
  contextType?: ReportContextType,
  contextId?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  if (user.id === reportedId) throw new Error('Cannot report yourself');

  const { error } = await supabase.from('user_reports').insert({
    reporter_id: user.id,
    reported_id: reportedId,
    reason,
    details: details ?? null,
    context_type: contextType ?? null,
    context_id: contextId ?? null,
  });

  if (error) throw error;
}
