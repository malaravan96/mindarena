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
  type: 'logic' | 'pattern' | 'math' | 'reasoning';
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
