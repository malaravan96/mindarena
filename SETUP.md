# MindArena Setup Guide

This guide will help you set up your MindArena MVP with proper authentication and database configuration.

## Prerequisites

- Supabase account and project created
- Node.js and npm installed
- Expo CLI installed

## Step 1: Configure Environment Variables

Your `.env` file has been updated with the correct format. Make sure it contains:

```env
EXPO_PUBLIC_SUPABASE_URL=https://gvuezvbvsdobbyadmskv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**Important:** The URL must be in HTTPS format, not a PostgreSQL connection string.

## Step 2: Apply Database Schema

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/schema.sql`
4. Paste it into a new query
5. Click **Run** to execute

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref gvuezvbvsdobbyadmskv

# Apply migrations
supabase db push
```

## Step 3: Seed Initial Data

After applying the schema, seed some test puzzles:

1. Open the **SQL Editor** in Supabase Dashboard
2. Copy the contents of `supabase/seed.sql`
3. **Update the date_key values** to today's date and future dates
4. Run the query

Example:
```sql
-- Change '2026-02-10' to today's date
insert into public.puzzles(date_key, title, prompt, type, options, answer_index)
values (
  '2026-02-10',  -- <-- Update this to current date
  'Pattern Recognition',
  'What comes next in the sequence? 3, 6, 12, 24, ?',
  'pattern',
  array['27', '36', '48', '60'],
  2
);
```

## Step 4: Configure Authentication

### Enable Email Authentication

1. Go to **Authentication** → **Providers** in Supabase Dashboard
2. Enable **Email** provider
3. Configure email templates (optional but recommended):
   - Go to **Authentication** → **Email Templates**
   - Customize the "Magic Link" template

### Set Up Deep Linking for Magic Links

The app is already configured to handle `mindarena://` deep links. Make sure to test this works on your device.

## Step 5: Verify Row Level Security

Your schema includes RLS policies. Verify they're enabled:

1. Go to **Authentication** → **Policies**
2. Check that all tables have policies:
   - ✅ `profiles`: Users can read all, update own
   - ✅ `puzzles`: Public read access
   - ✅ `attempts`: Users can insert own, read all (for leaderboard)

## Step 6: Test the Application

### Install Dependencies

```bash
npm install
# or
yarn install
```

### Run the App

```bash
# For iOS
npx expo start --ios

# For Android
npx expo start --android

# For web
npx expo start --web
```

## Step 7: Test Authentication Flow

1. **Sign Up/Sign In:**
   - Enter an email address
   - Click "Send Magic Link"
   - Check your email for the magic link
   - Click the link to authenticate

2. **Profile Creation:**
   - After signing in, your profile should be auto-created
   - Go to Profile page
   - Update your display name
   - Click "Save Profile"

3. **Solve a Puzzle:**
   - Return to home page
   - Select an answer
   - Submit your attempt

4. **Check Leaderboard:**
   - Navigate to Leaderboard
   - Verify your attempt appears if correct

## Database Schema Overview

### Tables

1. **profiles** - User display information
   - Automatically created on signup via trigger
   - Users can update their own profile

2. **puzzles** - Daily puzzles
   - One puzzle per day (identified by `date_key`)
   - Contains question, options, and answer

3. **attempts** - User submissions
   - Tracks user's answers and timing
   - Used for leaderboard rankings
   - One attempt per user per puzzle (enforced by unique constraint)

### Key Features Implemented

- ✅ Auto-profile creation on user signup
- ✅ Row Level Security (RLS) for all tables
- ✅ Proper indexes for performance
- ✅ One attempt per user per puzzle constraint
- ✅ Email-based passwordless authentication
- ✅ Offline fallback for puzzles

## Troubleshooting

### Issue: "Missing Supabase env vars"

- Check that your `.env` file is in the project root
- Verify the URL format is `https://...` not `postgresql://...`
- Restart the Expo development server

### Issue: "Profile save failed"

- Verify the schema was applied correctly
- Check that the trigger `on_auth_user_created` exists
- Try signing out and signing in again

### Issue: "No puzzle found"

- Check that you've run the seed.sql
- Verify the date_key matches today's date
- The app will use offline puzzles as fallback

### Issue: Magic link not working

- Verify Email provider is enabled in Supabase
- Check spam folder
- For testing, you can use the Supabase Dashboard to create test users

## Next Steps

1. **Add more puzzles**: Create a daily cron job or manual process to add new puzzles
2. **Implement streak calculation**: Track consecutive days of solving
3. **Add achievements**: Reward users for milestones
4. **Push notifications**: Remind users of daily puzzles
5. **Social features**: Share results, friend leaderboards

## Support

If you encounter issues:
1. Check the Supabase logs in Dashboard
2. Check the Expo console for errors
3. Verify all environment variables are correct
4. Ensure the database schema is applied correctly
