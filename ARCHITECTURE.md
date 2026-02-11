# MindArena Registration System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MindArena App                            │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Auth Screens  │  │   Validation    │  │   Components    │ │
│  │                 │  │                 │  │                 │ │
│  │  • Sign In      │  │  • Email        │  │  • Button       │ │
│  │  • Register     │  │  • Password     │  │  • Input        │ │
│  │  • Reset Pass   │  │  • Username     │  │  • Card         │ │
│  │  • Verify Email │  │  • DisplayName  │  │  • Container    │ │
│  │  • Onboarding   │  │                 │  │                 │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘ │
│           │                    │                                 │
│           └────────────────────┴──────────────┐                 │
│                                                │                 │
│                                    ┌───────────▼──────────────┐  │
│                                    │   Supabase Client       │  │
│                                    │   (lib/supabase.ts)     │  │
│                                    └───────────┬─────────────┘  │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 │ HTTPS/WebSocket
                                                 │
                             ┌───────────────────▼───────────────────┐
                             │         Supabase Backend             │
                             │                                       │
                             │  ┌─────────────────────────────────┐ │
                             │  │      Supabase Auth (GoTrue)     │ │
                             │  │                                 │ │
                             │  │  • User Management             │ │
                             │  │  • JWT Token Generation        │ │
                             │  │  • Email Sending (Magic Link)  │ │
                             │  │  • Password Reset              │ │
                             │  │  • Session Management          │ │
                             │  └────────────┬────────────────────┘ │
                             │               │                       │
                             │  ┌────────────▼────────────────────┐ │
                             │  │      PostgreSQL Database        │ │
                             │  │                                 │ │
                             │  │  Tables:                        │ │
                             │  │  • auth.users                   │ │
                             │  │  • public.profiles              │ │
                             │  │  • public.puzzles               │ │
                             │  │  • public.attempts              │ │
                             │  │                                 │ │
                             │  │  Views:                         │ │
                             │  │  • public.leaderboard           │ │
                             │  │                                 │ │
                             │  │  Triggers:                      │ │
                             │  │  • handle_new_user()            │ │
                             │  │  • update_user_stats()          │ │
                             │  └─────────────────────────────────┘ │
                             └───────────────────────────────────────┘
```

## Authentication Flow

### 1. Registration Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. Opens app
     ▼
┌─────────────────┐
│  Sign In Screen │
│   (index.tsx)   │
└────┬────────────┘
     │
     │ 2. Clicks "Sign Up"
     ▼
┌─────────────────────┐
│  Register Screen    │
│  (register.tsx)     │
└────┬────────────────┘
     │
     │ 3. Fills form:
     │    - Username
     │    - Email
     │    - Password
     │    - Confirm Password
     ▼
┌─────────────────────┐
│   Validation        │
│  (validation.ts)    │
└────┬────────────────┘
     │
     │ 4. If valid
     ▼
┌─────────────────────────────┐
│  Supabase Auth              │
│  supabase.auth.signUp()     │
└────┬────────────────────────┘
     │
     │ 5. Creates user in auth.users
     ▼
┌─────────────────────────────┐
│  Database Trigger           │
│  handle_new_user()          │
└────┬────────────────────────┘
     │
     │ 6. Creates profile in public.profiles
     ▼
┌─────────────────────────────┐
│  Email Sent                 │
│  (Verification Link)        │
└────┬────────────────────────┘
     │
     │ 7. (Optional)
     ▼
┌─────────────────────────────┐
│  Onboarding                 │
│  (onboarding.tsx)           │
└────┬────────────────────────┘
     │
     │ 8. Redirects to app
     ▼
┌─────────────────────────────┐
│  Main App                   │
│  (app)/(app)/index.tsx      │
└─────────────────────────────┘
```

### 2. Magic Link Sign-In Flow

```
User enters email → Click "Send Magic Link" → Supabase sends email
                                                      │
                                                      ▼
                                              Email with link
                                                      │
                                                      ▼
User clicks link → Deep link opens app → Auto sign-in → Main App
```

### 3. Password Sign-In Flow

```
User enters email + password → Click "Sign In" → Supabase validates
                                                         │
                                                         ▼
                                                   Valid credentials?
                                                    /           \
                                                 YES             NO
                                                  │               │
                                                  ▼               ▼
                                            JWT Token         Error message
                                                  │
                                                  ▼
                                              Main App
```

### 4. Password Reset Flow

```
User clicks "Forgot Password?" → Enter email → Click "Send Reset Link"
                                                         │
                                                         ▼
                                                 Supabase sends email
                                                         │
                                                         ▼
                                                Email with reset link
                                                         │
                                                         ▼
User clicks link → Deep link opens app → Reset Password Screen
                                                         │
                                                         ▼
                                         Enter new password + confirm
                                                         │
                                                         ▼
                                           Supabase updates password
                                                         │
                                                         ▼
                                                     Success!
                                                         │
                                                         ▼
                                                     Main App
```

## Data Flow

### Creating a Profile on Registration

```
┌──────────────────────────────────────────────────────────────────┐
│                    Registration Submit                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  supabase.auth.signUp({                                          │
│    email: "user@example.com",                                    │
│    password: "SecurePass123",                                    │
│    options: {                                                    │
│      emailRedirectTo: "mindarena://",                            │
│      data: { username: "cooluser" }                              │
│    }                                                             │
│  })                                                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  INSERT INTO auth.users                                          │
│  VALUES (                                                        │
│    id: "uuid-generated",                                         │
│    email: "user@example.com",                                    │
│    encrypted_password: "hashed...",                              │
│    raw_user_meta_data: { username: "cooluser" }                  │
│  )                                                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ TRIGGER: on_auth_user_created
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  FUNCTION: handle_new_user()                                     │
│                                                                  │
│  INSERT INTO public.profiles (id, username, email)               │
│  VALUES (                                                        │
│    NEW.id,                                                       │
│    NEW.raw_user_meta_data->>'username',                          │
│    NEW.email                                                     │
│  )                                                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Profile Created in Database:                                    │
│                                                                  │
│  {                                                               │
│    id: "uuid-same-as-auth-user",                                 │
│    username: "cooluser",                                         │
│    email: "user@example.com",                                    │
│    total_points: 0,                                              │
│    streak_count: 0,                                              │
│    created_at: "2024-01-15T10:30:00Z"                            │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

### Updating Stats After Puzzle Attempt

```
┌──────────────────────────────────────────────────────────────────┐
│  User completes puzzle (correct answer)                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  supabase.from('attempts').insert({                              │
│    user_id: "user-uuid",                                         │
│    puzzle_id: "puzzle-uuid",                                     │
│    is_correct: true,                                             │
│    ms_taken: 15000,                                              │
│    selected_index: 2                                             │
│  })                                                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ TRIGGER: update_stats_after_attempt
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  FUNCTION: update_user_stats_after_attempt()                     │
│                                                                  │
│  IF is_correct:                                                  │
│    UPDATE public.profiles                                        │
│    SET                                                           │
│      total_points = total_points + puzzle.points,                │
│      streak_count = (check if consecutive day),                  │
│      last_puzzle_date = CURRENT_DATE                             │
│    WHERE id = user_id                                            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Profile Updated:                                                │
│                                                                  │
│  {                                                               │
│    total_points: 0 → 100,                                        │
│    streak_count: 0 → 1,                                          │
│    last_puzzle_date: null → "2024-01-15"                         │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

## Security Architecture

### Row Level Security (RLS)

```
┌──────────────────────────────────────────────────────────────────┐
│                      Database Tables                             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  public.profiles                                                 │
│                                                                  │
│  RLS Policies:                                                   │
│  ✓ SELECT: Everyone can view profiles                            │
│  ✓ INSERT: Only during signup (auth.uid() = id)                  │
│  ✓ UPDATE: Users can only update their own (auth.uid() = id)     │
│  ✗ DELETE: Not allowed                                           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  public.attempts                                                 │
│                                                                  │
│  RLS Policies:                                                   │
│  ✓ SELECT: Users see only their attempts (auth.uid() = user_id)  │
│  ✓ INSERT: Users can only insert their attempts                  │
│  ✗ UPDATE: Not allowed                                           │
│  ✗ DELETE: Not allowed                                           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  public.puzzles                                                  │
│                                                                  │
│  RLS Policies:                                                   │
│  ✓ SELECT: Everyone can view puzzles                             │
│  ✗ INSERT: Admin only (not implemented)                          │
│  ✗ UPDATE: Admin only (not implemented)                          │
│  ✗ DELETE: Admin only (not implemented)                          │
└──────────────────────────────────────────────────────────────────┘
```

### Password Security

```
User Password: "MyPassword123"
              │
              ▼
┌──────────────────────────────┐
│  Client (React Native)       │
│  • Never logged              │
│  • Sent over HTTPS only      │
└──────────────┬───────────────┘
              │
              ▼
┌──────────────────────────────┐
│  Supabase Auth               │
│  • Receives password         │
│  • Hashes with bcrypt        │
│  • Salt rounds: 10           │
└──────────────┬───────────────┘
              │
              ▼
┌──────────────────────────────┐
│  Database                    │
│  Stores:                     │
│  encrypted_password:         │
│  "$2a$10$hash..."            │
│  (irreversible)              │
└──────────────────────────────┘
```

### Session Management

```
┌──────────────────────────────────────────────────────────────────┐
│  User Signs In                                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Supabase Auth generates JWT tokens:                             │
│                                                                  │
│  {                                                               │
│    access_token: "eyJhbGci...",    // Valid for 1 hour          │
│    refresh_token: "eyJhbGci...",   // Valid for 30 days         │
│    expires_in: 3600,                                             │
│    expires_at: 1234567890                                        │
│  }                                                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Secure Storage (Platform-specific):                             │
│                                                                  │
│  iOS: Keychain                                                   │
│  Android: EncryptedSharedPreferences                             │
│  Web: localStorage                                               │
│                                                                  │
│  Stores encrypted session data                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Automatic Token Refresh:                                        │
│                                                                  │
│  When access_token expires:                                      │
│  1. Client sends refresh_token                                   │
│  2. Supabase validates refresh_token                             │
│  3. Issues new access_token                                      │
│  4. Updates storage                                              │
│                                                                  │
│  → User stays signed in seamlessly                               │
└──────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
app/
├── (auth)/                    ← Authentication group
│   ├── _layout.tsx            ← No header wrapper
│   ├── index.tsx              ← Magic link sign-in
│   ├── register.tsx           ← Registration
│   ├── sign-in-password.tsx   ← Password sign-in
│   ├── forgot-password.tsx    ← Request reset
│   ├── reset-password.tsx     ← Set new password
│   ├── verify-email.tsx       ← Email verification
│   └── onboarding.tsx         ← Welcome guide
│
├── (app)/                     ← Main app group
│   ├── _layout.tsx            ← Tab navigation
│   ├── index.tsx              ← Home/Daily puzzle
│   ├── leaderboard.tsx        ← Rankings
│   └── profile.tsx            ← User profile
│
└── _layout.tsx                ← Root layout
                               ← Handles auth state
                               ← Shows (auth) or (app)

components/
├── Button.tsx                 ← Reusable button
├── Input.tsx                  ← Form input
├── Card.tsx                   ← Card container
└── Container.tsx              ← Page container

lib/
├── supabase.ts                ← Supabase client
├── validation.ts              ← Form validation
├── types.ts                   ← TypeScript types
├── puzzles.ts                 ← Puzzle data
└── date.ts                    ← Date utilities

contexts/
└── ThemeContext.tsx           ← Theme provider

constants/
└── theme.ts                   ← Design system
```

## Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend                                                        │
│  • React Native 0.74.5                                           │
│  • Expo 51.0.0                                                   │
│  • TypeScript 5.3.3                                              │
│  • Expo Router 3.5.0 (file-based routing)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Backend                                                         │
│  • Supabase (BaaS)                                               │
│    ├── PostgreSQL (Database)                                     │
│    ├── GoTrue (Auth)                                             │
│    ├── PostgREST (API)                                           │
│    └── Realtime (WebSocket)                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Libraries                                                       │
│  • @supabase/supabase-js (Client)                                │
│  • expo-secure-store (Secure storage)                            │
│  • expo-linking (Deep links)                                     │
│  • react-native-url-polyfill (URL support)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

**This architecture provides:**
- ✅ Scalable authentication system
- ✅ Secure password management
- ✅ Row-level security
- ✅ Automatic profile creation
- ✅ Session management
- ✅ Email verification
- ✅ Password reset
- ✅ Deep linking
- ✅ Cross-platform support
- ✅ Type safety
