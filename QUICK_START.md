# Quick Start - User Registration Setup

## 🚀 Get Started in 5 Minutes

### Step 1: Set Up Supabase (2 minutes)

1. Go to [supabase.com](https://supabase.com) and create a project
2. Once created, go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Settings > API** and copy:
   - Project URL
   - Anon/Public key

### Step 2: Configure Environment (1 minute)

Create `.env` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Enable Email Auth in Supabase (1 minute)

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. (Optional) Customize email templates under **Email Templates**

### Step 4: Run the App (1 minute)

```bash
npm install
npm start
```

That's it! 🎉

## 📱 Testing the Registration Flow

### Test New User Registration

1. Open the app
2. Click **"Sign Up"** on the sign-in screen
3. Fill in:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `Test1234`
   - Confirm Password: `Test1234`
4. Click **"Create Account"**
5. Check your email for verification (optional)

### Test Sign In

#### With Password:
1. Click **"Sign in with Password"**
2. Enter email and password
3. Click **"Sign In"**

#### With Magic Link:
1. Enter email on main sign-in screen
2. Click **"Send Magic Link"**
3. Check email and click the link

### Test Password Reset

1. Click **"Forgot password?"**
2. Enter your email
3. Check email for reset link
4. Click link and set new password

## 🎯 What's Included

### Screens
- ✅ Sign In (Magic Link)
- ✅ Sign In with Password
- ✅ User Registration
- ✅ Forgot Password
- ✅ Reset Password
- ✅ Email Verification
- ✅ Onboarding Flow

### Features
- ✅ Form validation
- ✅ Error handling
- ✅ Email verification
- ✅ Password requirements
- ✅ Username validation
- ✅ Automatic profile creation
- ✅ Secure password storage
- ✅ Deep linking support

### Database Tables
- ✅ `profiles` - User profiles
- ✅ `puzzles` - Daily puzzles
- ✅ `attempts` - User attempts
- ✅ `leaderboard` - View for rankings

### Security
- ✅ Row Level Security (RLS)
- ✅ Secure password hashing
- ✅ Session management
- ✅ Email verification

## 🔧 Customization

### Change Password Requirements

Edit `lib/validation.ts`:

```typescript
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  // Add or remove requirements here
}
```

### Customize Onboarding

Edit `app/(auth)/onboarding.tsx`:

```typescript
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Your Title',
    description: 'Your description',
    icon: '🎯',
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
  },
  // Add more steps
];
```

### Make Email Verification Required

In `app/(auth)/register.tsx`, after successful registration, redirect to verify-email:

```typescript
// Change this:
router.replace('/(app)')

// To this:
router.replace('/(auth)/verify-email')
```

## 📚 File Organization

```
app/(auth)/
├── index.tsx              ← Magic link sign-in (main)
├── register.tsx           ← New user registration
├── sign-in-password.tsx   ← Password sign-in
├── forgot-password.tsx    ← Request password reset
├── reset-password.tsx     ← Set new password
├── verify-email.tsx       ← Email verification
└── onboarding.tsx         ← First-time user guide

lib/
├── validation.ts          ← Form validation
├── types.ts              ← TypeScript types
└── supabase.ts           ← Supabase client

Database:
└── supabase-schema.sql   ← Database schema
```

## 🐛 Common Issues

### "Missing Supabase env vars" warning
- Ensure `.env` file exists
- Restart the development server: `npm start`

### Email not sending
- Check Supabase email settings
- Verify email provider configuration
- Check spam folder

### Deep links not working
- Test on a physical device
- Verify `scheme: "mindarena"` in `app.json`

### Profile not created
- Check Supabase SQL Editor for errors
- Verify triggers are enabled
- Check RLS policies

## 🎓 Learn More

- Full documentation: `REGISTRATION_GUIDE.md`
- Database schema: `supabase-schema.sql`
- Validation utilities: `lib/validation.ts`
- Type definitions: `lib/types.ts`

## ✨ What's Next?

After registration is working, consider adding:

1. **Social Login** (Google, Apple, GitHub)
2. **Profile Editing** (avatar, bio, display name)
3. **Account Settings** (change email, delete account)
4. **Two-Factor Authentication**
5. **Password Strength Indicator**

Happy coding! 🚀
