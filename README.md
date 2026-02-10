# MindArena (MVP) — Brain Games / Daily Puzzle + Leaderboard

This is a **fully runnable Expo app** (Expo Router + TypeScript) that includes:
- Email Magic Link sign-in (Supabase Auth)
- Daily Puzzle (from Supabase table) + offline fallback puzzles
- Submissions (attempts) stored in Supabase
- Leaderboard (top times for today's puzzle)

## 1) Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project and add environment variables:
   - Copy `.env.example` to `.env`
   - Fill:
     - `EXPO_PUBLIC_SUPABASE_URL`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

3. Create DB tables using the SQL in `supabase/schema.sql`.

4. Run:
   ```bash
   npm start
   ```

## 2) Notes
- Magic link requires email provider enabled in Supabase Auth settings.
- RLS policies are included in the SQL.

## 3) What to build next
- Friend system + challenges
- Live duels with realtime channels
- More puzzle types (logic grid, visual, memory, etc.)
