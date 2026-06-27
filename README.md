# GymCoach

A mobile coaching app for iOS and Android built with React Native + Expo. Coaches log workout sessions, track client packages, and receive automated low-session email reminders. Clients view their package status and full workout history in read-only mode.

## Tech stack

| Layer | Tool |
|---|---|
| Mobile | React Native + Expo SDK 51 |
| Navigation | Expo Router v3 (file-based) |
| Backend / Auth / DB | Supabase (free tier) |
| Email | Resend (free tier) |
| Edge Functions | Supabase Edge Functions (Deno) |

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/) and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- A [Supabase](https://supabase.com) account (free)
- A [Resend](https://resend.com) account (free)
- iOS Simulator (Xcode) or Android emulator, or the [Expo Go](https://expo.dev/client) app on a physical device

---

## 1 — Supabase project setup

### 1.1 Create a project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name, set a strong database password, pick the region closest to your users
3. Wait for the project to provision (~60 seconds)

### 1.2 Run the database migrations

In the Supabase dashboard, open **SQL Editor** and run the contents of each file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_session_reminder_webhook.sql
```

This creates all tables, enums, triggers, generated columns, and RLS policies.

### 1.3 Deploy Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```

Deploy the three Edge Functions:

```bash
supabase functions deploy create-client
supabase functions deploy send-email
supabase functions deploy session-reminder
```

### 1.4 Set Edge Function secrets

In the Supabase dashboard → **Edge Functions** → **Manage secrets**, add:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key (see section 2) |
| `RESEND_FROM_ADDRESS` | e.g. `GymCoach <noreply@yourdomain.com>` |
| `SUPABASE_WEBHOOK_SECRET` | Any random string you generate (use it again in step 1.5) |

> `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are injected automatically — do not add them manually.

### 1.5 Create the DB webhook

Supabase doesn't support webhook creation via SQL. Configure it in the dashboard:

1. **Database** → **Webhooks** → **Create a new webhook**
2. Name: `session-reminder`
3. Table: `public.workout_sessions`
4. Events: `INSERT`
5. Type: **HTTP Request**
6. URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/session-reminder`
7. HTTP Headers:
   - `Content-Type: application/json`
   - `x-supabase-signature: YOUR_WEBHOOK_SECRET` (same value as above)

### 1.6 Get your API credentials

**Settings** → **API**:

- `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
- `anon public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 1.7 Create your coach account

In the Supabase dashboard → **Authentication** → **Users** → **Invite user**, create yourself as the coach. Then in **SQL Editor** run:

```sql
update public.profiles set role = 'coach' where email = 'your@email.com';
```

---

## 2 — Resend account setup

1. Sign up at [resend.com](https://resend.com)
2. **API Keys** → **Create API Key** → copy the key (`re_…`)
3. **Domains** → add and verify your sending domain (or use the Resend sandbox for testing)
4. Use `noreply@yourdomain.com` (or a Resend sandbox address) as `RESEND_FROM_ADDRESS`

---

## 3 — Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `RESEND_API_KEY` | Resend API key — **Edge Functions only, never in the app** |
| `RESEND_FROM_ADDRESS` | Verified sender address, e.g. `GymCoach <noreply@yourdomain.com>` |
| `SUPABASE_WEBHOOK_SECRET` | Shared secret between DB webhook and Edge Function |
| `EXPO_PUBLIC_APP_NAME` | Display name (e.g. `Gym Coaching`) |

> Variables prefixed `EXPO_PUBLIC_` are bundled into the app. All others are server-side only.

---

## 4 — Run locally

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

Then press:
- `i` — open iOS Simulator
- `a` — open Android emulator
- `w` — open in web browser (limited functionality)
- Scan the QR code with [Expo Go](https://expo.dev/client) on a physical device

---

## 5 — App structure

```
app/
  (auth)/login.tsx        # Login screen
  (coach)/
    (tabs)/               # Coach tab bar (Dashboard, Clients, Sessions, Profile)
    add-client.tsx        # Modal: add new client
    log-session.tsx       # Modal: log a workout session
    client/[id].tsx       # Client detail + session history
  (client)/
    index.tsx             # Client: package status
    workouts.tsx          # Client: full workout history
  index.tsx               # Role-based redirect after login
  _layout.tsx             # Root layout + deep-link handler

hooks/
  useClients.ts           # Coach: all clients with active packages
  useSessions.ts          # Coach: all (or filtered) sessions
  useClientData.ts        # Client: own package + sessions

context/
  AuthContext.tsx         # Global session, user, profile, role

supabase/
  migrations/             # SQL schema and webhook setup docs
  functions/
    create-client/        # Edge Function: coach creates client accounts
    session-reminder/     # Edge Function: email reminders at 2 and 1 sessions left
    send-email/           # Edge Function: generic send-email helper

constants/
  theme.ts                # Colors and typography
components/
  ErrorBanner.tsx         # Inline error + retry component
```

---

## 6 — Key features

### Coach
- **Add clients** via Edge Function (uses Supabase Admin API — service key never leaves the server)
- **Log sessions** with dynamic exercise cards (name, sets, reps, weight, notes)
- **Session history** per client and across all clients
- Package status badges: green / orange (≤2 remaining) / grey (expired)

### Client (read-only)
- **Package status card** with segmented progress bar and hero remaining count
- **Full workout history** grouped by month with exercise details

### Automated reminders
- DB webhook fires on every `workout_sessions` INSERT
- Edge Function checks `sessions_remaining` and sends Resend emails at 2 and 1 sessions left
- `email_logs` table with `UNIQUE(package_id, trigger_type)` prevents duplicate sends
- Always returns HTTP 200 (non-2xx triggers Supabase retry → duplicate emails)

---

## 7 — Testing the email reminder

Run this in **SQL Editor** after logging a session that brings a client to 2 or 1 remaining:

```sql
select test_session_reminder('YOUR_PACKAGE_UUID');
```

Or manually set `sessions_used` to trigger the boundary:

```sql
update packages set sessions_used = total_sessions - 2 where id = 'YOUR_PACKAGE_UUID';
```

Then log a session via the app and watch the `email_logs` table.

---

## 8 — Security notes

- RLS is enabled on all tables — coaches can only read/write their own clients' data, clients can only read their own data
- `coach_id` on packages and sessions is always set server-side (never trusted from the client)
- The `create-client` Edge Function verifies the caller's JWT and hard-codes `coach_id = caller.id`
- The `session-reminder` function requires a shared webhook secret header — it returns 401 if the secret is missing or wrong
- `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never leave Edge Functions
