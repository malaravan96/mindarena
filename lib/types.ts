/**
 * Database types for Supabase tables
 */

export interface Profile {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  total_points: number;
  streak_count: number;
  last_puzzle_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Puzzle {
  id: string;
  date_key: string;
  title: string;
  prompt: string;
  type: 'logic' | 'pattern' | 'math' | 'reasoning' | 'word' | 'memory' | 'visual' | 'spatial' | 'trivia';
  options: string[];
  answer_index: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
  created_at: string;
}

export interface Attempt {
  id: string;
  user_id: string;
  puzzle_id: string;
  selected_index: number;
  is_correct: boolean;
  ms_taken: number;
  points_earned?: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  total_points: number;
  streak_count: number;
  total_attempts: number;
  correct_attempts: number;
  rank: number;
}

export interface DmConversation {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  last_message_at: string;
  peer_id: string;
  peer_name: string;
  peer_avatar_url?: string | null;
  peer_is_online?: boolean;
  peer_last_seen_at?: string | null;
  last_message?: string;
  unread_count: number;
}

export type DmMessageType = 'text' | 'image' | 'voice' | 'video' | 'file';
export type DmMessageStatus = 'sent' | 'delivered' | 'seen';

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  status?: DmMessageStatus;
  message_type?: DmMessageType;
  attachment_url?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_duration?: number | null;
  attachment_width?: number | null;
  attachment_height?: number | null;
  expires_at?: string | null;
}

// ── Group Chat ───────────────────────────────────────────────

export type GroupRole = 'owner' | 'admin' | 'member';

export interface GroupConversation {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  max_members: number;
  unread_count?: number;
  last_message?: string | null;
  member_count?: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  last_read_at: string;
  profile?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export type GroupMessageType = 'text' | 'image' | 'voice' | 'video' | 'file' | 'system';

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  message_type: GroupMessageType;
  attachment_url?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_duration?: number | null;
  attachment_width?: number | null;
  attachment_height?: number | null;
  expires_at?: string | null;
  created_at: string;
  sender_profile?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface DmConversationSettings {
  conversation_id: string;
  disappearing_messages_ttl?: number | null; // seconds; null = disabled
  updated_at: string;
  updated_by?: string | null;
}

export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web';
  updated_at: string;
}

export interface PvpCallSession {
  id: string;
  match_id: string;
  caller_id: string;
  callee_id: string;
  status: 'ringing' | 'connected' | 'ended' | 'failed';
  started_at: string;
  ended_at?: string | null;
}

export type CallUiState = 'off' | 'connecting' | 'live' | 'reconnecting';

// Connection & block types
export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface UserConnection {
  id: string;
  requester_id: string;
  target_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface ConnectionWithProfile extends UserConnection {
  peer_id: string;
  peer_name: string;
  peer_avatar_url?: string | null;
}

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

// Form types
export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

export interface SignInFormData {
  email: string;
  password: string;
}

export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export interface ProfileUpdateFormData {
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

// ── Rewards & Progression ───────────────────────────────────

export interface XPLevel {
  level: number;
  xp_required: number;
  title: string;
}

export interface AvailableBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category: string;
  criteria: Record<string, any>;
  xp_reward: number;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: AvailableBadge;
}

export interface AvatarFrame {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  unlock_level: number;
  border_color: string;
  border_width: number;
}

export interface UserAvatarFrame {
  id: string;
  user_id: string;
  frame_id: string;
  unlocked_at: string;
}

export interface DailyReward {
  id: string;
  user_id: string;
  reward_date: string;
  day_number: number;
  xp_reward: number;
  claimed_at: string;
}

export interface UserTitle {
  id: string;
  user_id: string;
  title: string;
  source: string;
  earned_at: string;
}

// ── Puzzle Modes ────────────────────────────────────────────

export type PuzzleMode = 'daily' | 'timed' | 'streak' | 'practice' | 'tournament' | 'duel' | 'weekly_challenge';

export interface TimedChallengeSession {
  id: string;
  user_id: string;
  duration_seconds: number;
  puzzles_solved: number;
  total_score: number;
  started_at: string;
  ended_at?: string;
}

export interface PuzzleStreakSession {
  id: string;
  user_id: string;
  streak_length: number;
  max_difficulty_reached: string;
  total_score: number;
  started_at: string;
  ended_at?: string;
}

export interface CategoryMastery {
  id: string;
  user_id: string;
  category: string;
  puzzles_completed: number;
  current_level: number;
  updated_at: string;
}

export interface WeeklyChallenge {
  id: string;
  week_key: string;
  title: string;
  description: string;
  theme: string;
  point_multiplier: number;
  starts_at: string;
  ends_at: string;
}

// ── Tournaments ─────────────────────────────────────────────

export interface Tournament {
  id: string;
  title: string;
  description: string;
  type: 'elimination' | 'points';
  status: 'upcoming' | 'active' | 'completed';
  max_participants: number;
  participant_count: number;
  entry_fee: number;
  prize_xp: number;
  prize_title?: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  total_score: number;
  rounds_completed: number;
  eliminated: boolean;
  final_rank?: number;
  joined_at: string;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  puzzle_id: string;
  starts_at: string;
  ends_at: string;
  status: 'pending' | 'active' | 'completed';
}

export interface TournamentAttempt {
  id: string;
  round_id: string;
  user_id: string;
  selected_index: number;
  is_correct: boolean;
  ms_taken: number;
  score: number;
  created_at: string;
}

// ── Social Features ─────────────────────────────────────────

export type ActivityEventType =
  | 'puzzle_solved'
  | 'badge_earned'
  | 'level_up'
  | 'streak_milestone'
  | 'tournament_win'
  | 'duel_completed'
  | 'team_joined';

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  event_type: ActivityEventType;
  metadata: Record<string, any>;
  visibility: 'public' | 'friends';
  created_at: string;
  profile?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface PuzzleDuel {
  id: string;
  challenger_id: string;
  opponent_id: string;
  puzzle_id: string;
  status: 'pending' | 'active' | 'completed' | 'declined';
  challenger_ms?: number;
  opponent_ms?: number;
  challenger_correct?: boolean;
  opponent_correct?: boolean;
  winner_id?: string;
  created_at: string;
}

// ── Teams ───────────────────────────────────────────────────

export type TeamRole = 'owner' | 'admin' | 'member';

export interface Team {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  owner_id: string;
  member_count: number;
  total_points: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface TeamMessage {
  id: string;
  team_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface TeamChallenge {
  id: string;
  challenger_team_id: string;
  opponent_team_id: string;
  puzzle_id: string;
  status: 'pending' | 'active' | 'completed';
  challenger_score: number;
  opponent_score: number;
  winner_team_id?: string;
  created_at: string;
}
