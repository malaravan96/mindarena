# Setup Checklist - User Registration

Use this checklist to set up the user registration system in your MindArena app.

## ✅ Pre-Setup (Already Done)

- [x] User registration screens created
- [x] Form validation implemented
- [x] Password reset flow built
- [x] Email verification added
- [x] Onboarding flow created
- [x] Database schema written
- [x] TypeScript types defined
- [x] Zero TypeScript errors
- [x] Documentation complete

## 📋 Setup Steps (Your Tasks)

### Step 1: Supabase Setup (10 minutes)

- [ ] 1.1. Go to [supabase.com](https://supabase.com)
- [ ] 1.2. Click "Start your project"
- [ ] 1.3. Create a new organization (or use existing)
- [ ] 1.4. Create a new project
  - Project name: "mindarena" (or your choice)
  - Database password: (save this securely!)
  - Region: (choose closest to your users)
  - Pricing: Free tier is fine
- [ ] 1.5. Wait for project to be created (~2 minutes)

### Step 2: Database Setup (5 minutes)

- [ ] 2.1. In Supabase Dashboard, go to **SQL Editor**
- [ ] 2.2. Click "New query"
- [ ] 2.3. Open `supabase-schema.sql` from your project
- [ ] 2.4. Copy all contents
- [ ] 2.5. Paste into SQL Editor
- [ ] 2.6. Click "Run" (bottom right)
- [ ] 2.7. Verify success (should see "Success. No rows returned")
- [ ] 2.8. Go to **Table Editor** and verify these tables exist:
  - [ ] profiles
  - [ ] puzzles
  - [ ] attempts

### Step 3: Authentication Setup (3 minutes)

- [ ] 3.1. Go to **Authentication** → **Providers**
- [ ] 3.2. Find "Email" provider
- [ ] 3.3. Toggle to enable it
- [ ] 3.4. Configure settings:
  - [ ] Enable "Confirm email" (optional but recommended)
  - [ ] Enable "Secure email change"
  - [ ] Enable "Secure password change"
- [ ] 3.5. Click "Save"

### Step 4: Email Templates (Optional, 5 minutes)

- [ ] 4.1. Go to **Authentication** → **Email Templates**
- [ ] 4.2. Customize these templates:
  - [ ] **Confirm signup** (verification email)
  - [ ] **Magic Link** (passwordless login)
  - [ ] **Reset Password** (password reset)
- [ ] 4.3. Add your branding:
  - App name: "MindArena"
  - Logo URL: (optional)
  - Colors: Match your theme

### Step 5: Get API Keys (2 minutes)

- [ ] 5.1. Go to **Settings** → **API**
- [ ] 5.2. Find "Project URL" - copy this
- [ ] 5.3. Find "anon" / "public" key - copy this
- [ ] 5.4. Keep these secure (don't share publicly!)

### Step 6: Environment Configuration (2 minutes)

- [ ] 6.1. Create `.env` file in project root
- [ ] 6.2. Add these lines (replace with your values):
  ```env
  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  ```
- [ ] 6.3. Save the file
- [ ] 6.4. **IMPORTANT**: Verify `.env` is in `.gitignore`

### Step 7: Install Dependencies (1 minute)

- [ ] 7.1. Open terminal in project directory
- [ ] 7.2. Run:
  ```bash
  npm install
  ```
- [ ] 7.3. Wait for installation to complete

### Step 8: Test the App (5 minutes)

- [ ] 8.1. Start the development server:
  ```bash
  npm start
  ```
- [ ] 8.2. Open in Expo Go or simulator
- [ ] 8.3. Test registration:
  - [ ] Click "Sign Up"
  - [ ] Fill in form with test data
  - [ ] Submit
  - [ ] Check for success message
- [ ] 8.4. Check your email for verification
- [ ] 8.5. Test sign-in:
  - [ ] Try magic link
  - [ ] Try password sign-in
- [ ] 8.6. Test password reset:
  - [ ] Click "Forgot password"
  - [ ] Enter email
  - [ ] Check email for reset link

## 🔍 Verification Checklist

### Database Verification

- [ ] Tables created successfully
  - [ ] `public.profiles`
  - [ ] `public.puzzles`
  - [ ] `public.attempts`
- [ ] Triggers are active
  - [ ] `on_auth_user_created`
  - [ ] `update_stats_after_attempt`
- [ ] RLS policies enabled
  - [ ] Check Table Editor → each table → "RLS enabled"
- [ ] Indexes created
  - [ ] Check SQL Editor → run: `SELECT * FROM pg_indexes WHERE schemaname = 'public';`

### Authentication Verification

- [ ] Email provider enabled
- [ ] Can create new account
- [ ] Verification email sends
- [ ] Can sign in with password
- [ ] Magic link works
- [ ] Password reset works

### App Verification

- [ ] No TypeScript errors
  ```bash
  npm run typecheck
  ```
- [ ] No console errors when running app
- [ ] All screens load correctly
- [ ] Form validation works
- [ ] Error messages display properly
- [ ] Loading states show correctly

## 🐛 Troubleshooting

### Issue: "Missing Supabase env vars" warning

**Check:**
- [ ] `.env` file exists in project root
- [ ] Variables start with `EXPO_PUBLIC_`
- [ ] No typos in variable names
- [ ] Restarted development server

**Fix:**
```bash
# Stop the server (Ctrl+C)
# Then restart
npm start
```

### Issue: Email not sending

**Check:**
- [ ] Email provider enabled in Supabase
- [ ] SMTP configured (default works for testing)
- [ ] Check spam folder
- [ ] Email address is valid

**Fix:**
1. Go to Supabase → Authentication → Configuration
2. Verify SMTP settings
3. Try with a different email address

### Issue: Profile not created

**Check:**
- [ ] Trigger `on_auth_user_created` exists
- [ ] Trigger is enabled
- [ ] RLS policies allow INSERT

**Fix:**
1. Go to Supabase → SQL Editor
2. Run:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```
3. If empty, re-run schema from `supabase-schema.sql`

### Issue: Can't sign in after registration

**Check:**
- [ ] Email verification not required (or email verified)
- [ ] Correct password entered
- [ ] Account actually created (check auth.users table)

**Fix:**
1. Go to Supabase → Authentication → Users
2. Find your user
3. Click user → Verify email manually
4. Try signing in again

### Issue: Deep links not working

**Check:**
- [ ] Testing on physical device (may not work in simulator)
- [ ] `scheme: "mindarena"` in `app.json`
- [ ] expo-linking installed

**Fix:**
1. Test on real device
2. Rebuild app:
   ```bash
   expo prebuild
   npm run ios  # or npm run android
   ```

## 📚 Next Steps After Setup

Once everything is working:

### Immediate
- [ ] Test with real email addresses
- [ ] Customize email templates
- [ ] Set up error monitoring (Sentry)
- [ ] Test on physical devices (iOS + Android)

### Short-term
- [ ] Add profile editing
- [ ] Add avatar upload
- [ ] Add social authentication (Google, Apple)
- [ ] Add account deletion

### Long-term
- [ ] Add two-factor authentication
- [ ] Add login history
- [ ] Add session management
- [ ] Add account recovery codes

## 📖 Documentation Reference

After setup, keep these handy:

- **Quick Start**: `QUICK_START.md` - Fast reference guide
- **Full Guide**: `REGISTRATION_GUIDE.md` - Complete documentation
- **Architecture**: `ARCHITECTURE.md` - System design diagrams
- **Summary**: `IMPLEMENTATION_SUMMARY.md` - What's been built

## 🎉 Success Criteria

You're done when:

- [x] ✅ All database tables exist
- [x] ✅ All triggers working
- [x] ✅ RLS policies active
- [x] ✅ Can create new account
- [x] ✅ Email verification works
- [x] ✅ Can sign in with password
- [x] ✅ Magic link works
- [x] ✅ Password reset works
- [x] ✅ Profile created automatically
- [x] ✅ No errors in console
- [x] ✅ TypeScript passes

## 💡 Tips

1. **Use a real email** for testing email flows
2. **Check spam folder** if emails don't arrive
3. **Save database password** - you'll need it
4. **Test on real devices** for deep links
5. **Read error messages** - they're helpful!
6. **Check Supabase logs** if things fail
7. **Use SQL Editor** to inspect data

## 🆘 Need Help?

If you're stuck:

1. **Check documentation** - 90% of issues are covered
2. **Check Supabase logs** - Authentication → Logs
3. **Check database logs** - Database → Logs
4. **Supabase docs**: https://supabase.com/docs
5. **Expo docs**: https://docs.expo.dev

## ✨ You're Ready!

Once this checklist is complete, you have a **production-ready user registration system**!

Happy building! 🚀
