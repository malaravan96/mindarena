# User Registration Workflow - MindArena

This guide explains the complete user registration and authentication workflow implemented in the MindArena app.

## Features Implemented

### 1. **User Registration** (`/register`)
- Email and password sign-up
- Username collection (3-20 characters, alphanumeric, hyphens, underscores)
- Real-time form validation
- Password strength requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- Automatic profile creation in Supabase
- Email verification link sent automatically

### 2. **Sign In Options**

#### Magic Link Sign-In (`/`)
- Passwordless authentication
- Email-based magic link
- One-click sign-in from email

#### Password Sign-In (`/sign-in-password`)
- Traditional email/password authentication
- "Forgot password" link
- Option to switch to magic link

### 3. **Password Reset Flow**

#### Forgot Password (`/forgot-password`)
- Request password reset email
- Secure reset link sent to user's email
- Confirmation screen after sending

#### Reset Password (`/reset-password`)
- Accessed via email link
- Set new password with validation
- Same password strength requirements as registration

### 4. **Email Verification** (`/verify-email`)
- Verification email sent on registration
- Resend verification option
- Optional - users can continue without verifying
- Can be completed later from profile settings

### 5. **Onboarding Flow** (`/onboarding`)
- Three-step interactive guide
- App features overview
- Skip option available
- Smooth step-by-step navigation

## File Structure

```
app/
├── (auth)/
│   ├── index.tsx              # Magic link sign-in
│   ├── register.tsx           # User registration
│   ├── sign-in-password.tsx   # Password sign-in
│   ├── forgot-password.tsx    # Password reset request
│   ├── reset-password.tsx     # Set new password
│   ├── verify-email.tsx       # Email verification
│   ├── onboarding.tsx         # First-time user guide
│   └── _layout.tsx            # Auth layout wrapper
lib/
├── validation.ts              # Form validation utilities
├── types.ts                   # TypeScript types
└── supabase.ts               # Supabase client config
```

## Validation Rules

### Email
- Required field
- Must be valid email format (includes @ and .)
- Real-time validation feedback

### Username
- Required field
- 3-20 characters
- Only alphanumeric, hyphens, and underscores
- Unique across all users

### Password
- Required field
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

## Database Schema

### Profiles Table
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  total_points INTEGER DEFAULT 0,
  streak_count INTEGER DEFAULT 0,
  last_puzzle_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Setup Instructions

### 1. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema from `supabase-schema.sql` in the SQL Editor
3. Enable email authentication in Supabase Dashboard:
   - Go to Authentication > Providers
   - Enable Email provider
   - Configure email templates (optional)

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Configure Email Templates (Optional)

In Supabase Dashboard > Authentication > Email Templates, customize:
- **Confirm signup**: Verification email
- **Magic Link**: Passwordless login
- **Reset password**: Password reset email

### 4. Configure Deep Linking

Update `app.json` to ensure deep linking works:

```json
{
  "expo": {
    "scheme": "mindarena",
    ...
  }
}
```

## User Flow Diagrams

### Registration Flow
```
User visits app
    ↓
Sign In Screen (Magic Link or Password)
    ↓
Click "Sign Up" → Registration Screen
    ↓
Enter: Username, Email, Password
    ↓
Submit → Create Account
    ↓
Profile Created in Database
    ↓
Verification Email Sent
    ↓
(Optional) Onboarding Flow
    ↓
Main App
```

### Password Reset Flow
```
User clicks "Forgot Password"
    ↓
Enter Email
    ↓
Receive Reset Email
    ↓
Click Link in Email
    ↓
Enter New Password
    ↓
Password Updated
    ↓
Sign In with New Password
```

## Security Features

1. **Row Level Security (RLS)**
   - Users can only read/update their own profile
   - Public profiles viewable by all

2. **Secure Password Storage**
   - Passwords hashed by Supabase Auth
   - Never stored in plain text

3. **Email Verification**
   - Prevents fake accounts
   - Can be required or optional

4. **Session Management**
   - Automatic token refresh
   - Secure storage with expo-secure-store
   - Web: localStorage, Native: Keychain/Keystore

## Testing the Workflow

### Test User Registration
1. Open the app
2. Click "Sign Up"
3. Fill in the form with valid data
4. Submit and check for success message
5. Check email for verification link
6. Complete onboarding (optional)
7. Access main app features

### Test Password Reset
1. Click "Forgot Password"
2. Enter registered email
3. Check email for reset link
4. Click link and set new password
5. Sign in with new password

### Test Magic Link
1. Go to sign-in screen
2. Enter email
3. Click "Send Magic Link"
4. Check email and click link
5. Automatically signed in

## Troubleshooting

### Issue: Email not receiving
- Check Supabase email settings
- Verify SMTP configuration
- Check spam folder
- Ensure email provider allows Supabase emails

### Issue: Deep linking not working
- Verify `scheme` in app.json
- Test on physical device (deep links may not work in simulator)
- Check expo-linking configuration

### Issue: Profile not created
- Check Supabase triggers are enabled
- Verify RLS policies
- Check database logs in Supabase Dashboard

### Issue: Password validation failing
- Ensure password meets all requirements
- Check validation.ts for specific rules
- Test with: `Test123!` (meets all criteria)

## API Reference

### Validation Functions

```typescript
// lib/validation.ts

validateEmail(email: string): string | null
validatePassword(password: string): string | null
validateUsername(username: string): string | null
validateDisplayName(displayName: string): string | null
```

### Supabase Auth Methods

```typescript
// Sign up with email/password
await supabase.auth.signUp({
  email: string,
  password: string,
  options: {
    emailRedirectTo: string,
    data: { username: string }
  }
})

// Sign in with password
await supabase.auth.signInWithPassword({
  email: string,
  password: string
})

// Sign in with magic link
await supabase.auth.signInWithOtp({
  email: string,
  options: { emailRedirectTo: string }
})

// Reset password
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: string
})

// Update password
await supabase.auth.updateUser({
  password: string
})

// Resend verification
await supabase.auth.resend({
  type: 'signup',
  email: string
})
```

## Next Steps

After implementing registration, you can:

1. **Add Social Authentication**
   - Google Sign-In
   - Apple Sign-In
   - GitHub OAuth

2. **Enhanced Profile**
   - Profile picture upload
   - Bio and description
   - User preferences

3. **Account Management**
   - Delete account
   - Change email
   - Privacy settings

4. **Advanced Features**
   - Two-factor authentication
   - Account recovery codes
   - Login history

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Expo documentation: https://docs.expo.dev
- React Native documentation: https://reactnative.dev

## License

This registration workflow is part of the MindArena project.
