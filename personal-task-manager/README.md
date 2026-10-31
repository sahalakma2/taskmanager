# ApexTask — Single-Admin Personal Task Management Web Application

A production-ready, single-administrator Personal & Professional Task Management Web Application built with **React 18**, **TypeScript**, **Tailwind CSS**, **Lucide Icons**, and **Supabase** (PostgreSQL, Auth, Storage, and Edge Functions).

---

## 1. Architecture & Security Highlights

- **Single-Administrator Enforcement**:
  - Public signup is disabled.
  - Username-based login (`admin`) maps securely to the administrator's email via the `public.resolve_admin_username` PostgreSQL `SECURITY DEFINER` RPC function and authenticates via Supabase Auth (`signInWithPassword`).
  - All 10 database tables enforce strict **Row Level Security (RLS)** via `public.is_authenticated_admin(user_id)`.
  - Service-role credentials are never exposed in frontend code; initial admin creation is handled exclusively via `scripts/setup-admin.mjs`.
- **Consistent `Asia/Kolkata` (IST) Date Engine**:
  - Tasks are strictly date-based (`YYYY-MM-DD`).
  - Overdue status is computed dynamically: a task is **Overdue** (Red Card) only when `task_date < today_IST` and `status !== 'completed'`. Today's incomplete tasks remain **Pending** (White Card), and **Completed** tasks remain Green even after their original due date passes.
- **Voice Notes via Private Supabase Storage**:
  - Browser `MediaRecorder` captures audio with live duration timer, pause/resume, pre-save playback, delete, and re-record.
  - Uploaded to the private `voice-notes` bucket under `<user_id>/<task_id>/<timestamp>.webm` and accessed via signed URLs (with automatic IndexedDB blob persistence in local sandbox mode).

---

## 2. Supabase Backend Setup Procedure

### Step 1: Run the SQL Schema & RLS Migration
1. Open your Supabase Dashboard → **SQL Editor**.
2. Paste and execute the contents of `supabase/migrations/20261031000000_initial_schema.sql`.
3. In **Authentication → Providers → Email**, disable **Allow new users to sign up** so no public accounts can ever be registered.

### Step 2: Provision the Single Administrator Account
Run the server-side provisioning script from your terminal (requires Node.js 18+):

```bash
SUPABASE_URL="https://your-project-ref.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key" \
ADMIN_USERNAME="admin" \
ADMIN_EMAIL="admin@yourdomain.com" \
ADMIN_PASSWORD="YourStrongPassword!2026" \
npm run setup:admin
```

### Step 3: Deploy the Scheduled Push Notification Edge Function
```bash
supabase functions deploy push-scheduler
```
Configure a Supabase Cron job (`pg_cron`) to invoke `push-scheduler` hourly so Upcoming, Due Today, and Overdue notifications are generated and dispatched even when the browser tab is closed.

### Step 4: Configure Frontend Environment Variables (Vercel / Local)
Create `.env.local` (or set in Vercel Project Settings):
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
*(You can also connect your Supabase URL and Anon Key directly from the in-app **Supabase Connection** modal in Settings or on the Login screen.)*
