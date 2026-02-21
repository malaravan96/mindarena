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
  last_message?: string;
  unread_count: number;
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
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
