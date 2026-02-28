import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, TeamInvite } from '@/lib/types';

export async function createTeam(name: string, description: string): Promise<Team> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: name.trim(), description: description.trim(), owner_id: uid })
    .select('*')
    .maybeSingle<Team>();

  if (error) throw error;
  if (!team) throw new Error('Failed to create team');

  // Add owner as first member
  await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: uid,
    role: 'owner',
  });

  // Update profile with team_id
  await supabase.from('profiles').update({ team_id: team.id }).eq('id', uid);

  return team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .maybeSingle<Team>();

  if (error) return null;
  return data;
}

export async function getUserTeam(userId: string): Promise<Team | null> {
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .maybeSingle<{ team_id: string }>();

  if (!membership) return null;
  return await getTeam(membership.team_id);
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data: members, error } = await supabase
    .from('team_members')
    .select('id, team_id, user_id, role, joined_at')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error || !members) return [];

  const userIds = members.map((m: any) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [p.id, p]),
  );

  return members.map((m: any) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? undefined,
  }));
}

export async function joinTeam(teamId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not signed in');

  // Check if already in a team
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle<{ id: string }>();

  if (existing) throw new Error('You are already in a team. Leave your current team first.');

  const { error } = await supabase.from('team_members').insert({
    team_id: teamId,
    user_id: uid,
    role: 'member',
  });

  if (error) throw error;

  // Update member count
  await supabase.rpc('increment_team_member_count', { tid: teamId });

  // Update profile
  await supabase.from('profiles').update({ team_id: teamId }).eq('id', uid);
}

export async function leaveTeam(teamId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not signed in');

  // Check role - owners cannot leave, they must transfer ownership or disband
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', uid)
    .maybeSingle<{ role: string }>();

  if (!membership) throw new Error('You are not in this team');
  if (membership.role === 'owner') throw new Error('Owners cannot leave. Transfer ownership or disband the team.');

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', uid);

  if (error) throw error;

  // Decrement member count
  const { data: team } = await supabase
    .from('teams')
    .select('member_count')
    .eq('id', teamId)
    .maybeSingle<{ member_count: number }>();

  if (team) {
    await supabase
      .from('teams')
      .update({ member_count: Math.max(0, (team.member_count ?? 1) - 1) })
      .eq('id', teamId);
  }

  // Clear profile team_id
  await supabase.from('profiles').update({ team_id: null }).eq('id', uid);
}

export async function searchTeams(query: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('total_points', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as Team[];
}

export async function getTopTeams(limit = 50): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Team[];
}

export async function inviteToTeam(teamId: string, inviteeId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase.from('team_invites').insert({
    team_id: teamId,
    inviter_id: uid,
    invitee_id: inviteeId,
  });

  if (error) {
    if (error.code === '23505') throw new Error('Invite already sent');
    throw error;
  }
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
  const status = accept ? 'accepted' : 'declined';

  const { data: invite, error: fetchError } = await supabase
    .from('team_invites')
    .select('id, team_id')
    .eq('id', inviteId)
    .maybeSingle<{ id: string; team_id: string }>();

  if (fetchError || !invite) throw new Error('Invite not found');

  const { error } = await supabase
    .from('team_invites')
    .update({ status })
    .eq('id', inviteId);

  if (error) throw error;

  if (accept) {
    await joinTeam(invite.team_id);
  }
}

export async function getPendingInvites(userId: string): Promise<(TeamInvite & { team?: Team })[]> {
  const { data: invites, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !invites) return [];

  const teamIds = [...new Set(invites.map((i: any) => i.team_id))];
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .in('id', teamIds);

  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t]));

  return invites.map((i: any) => ({
    ...i,
    team: teamMap.get(i.team_id) ?? undefined,
  }));
}

export async function updateTeam(teamId: string, updates: { name?: string; description?: string; avatar_url?: string }): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId);

  if (error) throw error;
}
