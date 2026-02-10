# MindArena Setup Checklist

Use this checklist to ensure everything is properly configured.

## Database Setup

- [ ] Applied `supabase/schema.sql` to your Supabase project
- [ ] Verified all tables are created: `profiles`, `puzzles`, `attempts`
- [ ] Confirmed RLS is enabled on all tables
- [ ] Applied `supabase/seed.sql` with updated dates
- [ ] Checked that the trigger `on_auth_user_created` exists

## Environment Configuration

- [ ] Updated `.env` file with correct HTTPS URL (not PostgreSQL URL)
- [ ] Verified `EXPO_PUBLIC_SUPABASE_URL` starts with `https://`
- [ ] Confirmed `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set correctly

## Supabase Dashboard

- [ ] Enabled Email authentication provider
- [ ] Configured email templates (optional)
- [ ] Verified RLS policies in Authentication → Policies
- [ ] Added at least one test puzzle for today's date

## Application Testing

- [ ] Installed dependencies (`npm install`)
- [ ] App starts without errors (`npx expo start`)
- [ ] Can access sign-in screen
- [ ] Magic link email is received
- [ ] Authentication works (can sign in)
- [ ] Profile is auto-created after sign-in
- [ ] Can update display name in profile
- [ ] Can see today's puzzle
- [ ] Can submit an answer
- [ ] Leaderboard shows attempts
- [ ] Can sign out

## Known Issues Fixed

✅ Fixed: `.env` URL format (was PostgreSQL, now HTTPS)
✅ Fixed: Missing profile auto-creation trigger
✅ Fixed: Added unique constraint for one attempt per puzzle
✅ Fixed: Added proper indexes for performance
✅ Fixed: Seed data with example puzzles

## Quick Test Commands

```bash
# Install dependencies
npm install

# Start the app
npx expo start

# Clear cache if needed
npx expo start -c
```

## Database Verification Queries

Run these in Supabase SQL Editor to verify setup:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check if puzzles exist
SELECT date_key, title FROM public.puzzles;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

## Still Having Issues?

1. Check Supabase logs: Dashboard → Logs
2. Check Expo console for errors
3. Verify email in spam folder
4. Try signing out and in again
5. Clear app cache: `npx expo start -c`
