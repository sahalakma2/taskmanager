-- =============================================================================
-- PERSONAL TASK MANAGEMENT WEB APPLICATION - SUPABASE POSTGRESQL SCHEMA
-- Target: Single Administrator Personal & Professional Task Management System
-- Timezone Default: Asia/Kolkata (IST)
-- =============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set session timezone to Asia/Kolkata
SET timezone = 'Asia/Kolkata';

-- =============================================================================
-- 1. PROFILES TABLE (Single Administrator Profile & Auth Mapping)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) >= 3 AND char_length(username) <= 50),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Administrator',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Secure RPC function to resolve admin username to email ONLY for active admin
-- Security Definer with strict rate-safe lookup so login form can accept username
CREATE OR REPLACE FUNCTION public.resolve_admin_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.profiles
  WHERE LOWER(username) = LOWER(TRIM(p_username))
    AND role = 'admin'
    AND is_active = TRUE
  LIMIT 1;
  RETURN v_email;
END;
$$;

-- =============================================================================
-- 2. CATEGORIES TABLE (Custom Task Categories)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(TRIM(name)) > 0 AND char_length(name) <= 60),
  color TEXT NOT NULL DEFAULT '#2563EB',
  icon TEXT NOT NULL DEFAULT 'Briefcase',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- =============================================================================
-- 3. TASK RECURRENCES TABLE (Automated Repeating Schedule Rules)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_recurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  interval_value INTEGER NOT NULL DEFAULT 1 CHECK (interval_value >= 1 AND interval_value <= 365),
  custom_unit TEXT DEFAULT 'days' CHECK (custom_unit IN ('days', 'weeks', 'months')),
  weekdays INTEGER[] DEFAULT '{}', -- 0=Sun, 1=Mon, ..., 6=Sat for weekly recurrence
  month_day INTEGER CHECK (month_day IS NULL OR (month_day >= 1 AND month_day <= 31)),
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  last_generated_date DATE,
  occurrences_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_recurrences_user_status ON public.task_recurrences(user_id, status);

-- =============================================================================
-- 4. TASKS TABLE (Core Date-Based Tasks)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(TRIM(title)) > 0 AND char_length(title) <= 300),
  description TEXT DEFAULT '',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  task_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
  trashed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_history JSONB NOT NULL DEFAULT '[]'::JSONB,
  recurrence_id UUID REFERENCES public.task_recurrences(id) ON DELETE SET NULL,
  recurrence_occurrence_key TEXT UNIQUE, -- Idempotency key: '<recurrence_id>:<YYYY-MM-DD>'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON public.tasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status, is_trashed);
CREATE INDEX IF NOT EXISTS idx_tasks_user_pinned ON public.tasks(user_id, is_pinned) WHERE is_trashed = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON public.tasks(recurrence_id);

-- =============================================================================
-- 5. TASK REMARKS TABLE (Chronological Immutable/Audited Remarks History)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_remarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(TRIM(content)) > 0),
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_remarks_task_created ON public.task_remarks(task_id, created_at ASC);

-- =============================================================================
-- 6. TASK ATTACHMENTS TABLE (Voice Notes & Audio Recordings in Supabase Storage)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'voice-notes',
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);

-- =============================================================================
-- 7. NOTIFICATIONS TABLE (Reminders, Due Today, Overdue Alerts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('upcoming', 'due_today', 'overdue', 'system', 'recurrence')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  dedupe_key TEXT UNIQUE, -- Prevents duplicate daily reminders for the same task & date
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- =============================================================================
-- 8. ACTIVITY LOGS TABLE (Audit Trail for Security & Data Reliability)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'remark', 'category', 'voice_note', 'recurrence', 'settings', 'auth')),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs(user_id, created_at DESC);

-- =============================================================================
-- 9. USER PREFERENCES TABLE (Settings, Custom Heading, Theme, Timezone, View)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  custom_dashboard_heading TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  default_task_view TEXT NOT NULL DEFAULT 'grid' CHECK (default_task_view IN ('grid', 'list')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  date_format TEXT NOT NULL DEFAULT 'DD MMM YYYY',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notify_upcoming BOOLEAN NOT NULL DEFAULT TRUE,
  notify_due_today BOOLEAN NOT NULL DEFAULT TRUE,
  notify_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_hour_ist INTEGER NOT NULL DEFAULT 9 CHECK (reminder_hour_ist >= 0 AND reminder_hour_ist <= 23),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 10. PUSH SUBSCRIPTIONS TABLE (Web Push API Endpoints for Background Alerts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON public.push_subscriptions(user_id, is_active);

-- =============================================================================
-- AUTOMATIC UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'categories', 'task_recurrences', 'tasks',
    'task_remarks', 'task_attachments', 'user_preferences', 'push_subscriptions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t, t);
  END LOOP;
END;
$$;

-- =============================================================================
-- DYNAMIC OVERDUE CALCULATION VIEW (Asia/Kolkata Timezone)
-- =============================================================================
CREATE OR REPLACE VIEW public.tasks_with_computed_status AS
SELECT
  t.*,
  c.name AS category_name,
  c.color AS category_color,
  CASE
    WHEN t.status = 'completed' THEN 'completed'
    WHEN t.task_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN 'overdue'
    ELSE 'pending'
  END AS computed_status
FROM public.tasks t
LEFT JOIN public.categories c ON t.category_id = c.id;

-- =============================================================================
-- SERVER-SIDE RECURRING TASK OCCURRENCE GENERATOR (IDEMPOTENT)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_next_recurring_occurrence(p_task_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_rec public.task_recurrences%ROWTYPE;
  v_next_date DATE;
  v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_base_date DATE;
  v_new_task_id UUID;
  v_occ_key TEXT;
  v_dow INTEGER;
  v_i INTEGER;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.recurrence_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_rec FROM public.task_recurrences WHERE id = v_task.recurrence_id;
  IF NOT FOUND OR v_rec.status <> 'active' THEN
    RETURN NULL;
  END IF;

  -- Handle missed schedules safely: advance from max(task_date, today_ist - interval) or task_date
  v_base_date := GREATEST(v_task.task_date, v_rec.start_date);

  IF v_rec.frequency = 'daily' THEN
    v_next_date := v_base_date + (v_rec.interval_value || ' days')::INTERVAL;
    IF v_next_date < v_today_ist THEN
      v_next_date := v_today_ist;
    END IF;
  ELSIF v_rec.frequency = 'weekly' THEN
    IF array_length(v_rec.weekdays, 1) IS NOT NULL AND array_length(v_rec.weekdays, 1) > 0 THEN
      -- Find next matching weekday
      FOR v_i IN 1..14 LOOP
        v_next_date := v_base_date + (v_i || ' days')::INTERVAL;
        v_dow := EXTRACT(DOW FROM v_next_date)::INTEGER;
        IF v_dow = ANY(v_rec.weekdays) THEN
          EXIT;
        END IF;
      END LOOP;
    ELSE
      v_next_date := v_base_date + ((v_rec.interval_value * 7) || ' days')::INTERVAL;
    END IF;
  ELSIF v_rec.frequency = 'monthly' THEN
    v_next_date := (v_base_date + (v_rec.interval_value || ' months')::INTERVAL)::DATE;
    IF v_rec.month_day IS NOT NULL THEN
      -- Clamp safely to end of target month
      v_next_date := make_date(
        EXTRACT(YEAR FROM v_next_date)::INTEGER,
        EXTRACT(MONTH FROM v_next_date)::INTEGER,
        LEAST(v_rec.month_day, EXTRACT(DAY FROM (date_trunc('month', v_next_date) + INTERVAL '1 month - 1 day'))::INTEGER)
      );
    END IF;
  ELSE
    -- Custom recurrence
    v_next_date := (v_base_date + (v_rec.interval_value || ' ' || COALESCE(v_rec.custom_unit, 'days'))::INTERVAL)::DATE;
  END IF;

  -- Check end_date constraint
  IF v_rec.end_date IS NOT NULL AND v_next_date > v_rec.end_date THEN
    UPDATE public.task_recurrences SET status = 'stopped' WHERE id = v_rec.id;
    RETURN NULL;
  END IF;

  v_occ_key := v_rec.id::TEXT || ':' || v_next_date::TEXT;

  -- Prevent duplicate generation using unique recurrence_occurrence_key
  INSERT INTO public.tasks (
    user_id, title, description, category_id, task_date,
    priority, status, is_pinned, recurrence_id, recurrence_occurrence_key
  ) VALUES (
    v_task.user_id, v_task.title, v_task.description, v_task.category_id, v_next_date,
    v_task.priority, 'pending', v_task.is_pinned, v_rec.id, v_occ_key
  )
  ON CONFLICT (recurrence_occurrence_key) DO NOTHING
  RETURNING id INTO v_new_task_id;

  IF v_new_task_id IS NOT NULL THEN
    UPDATE public.task_recurrences
    SET last_generated_date = v_next_date,
        occurrences_count = occurrences_count + 1
    WHERE id = v_rec.id;
  END IF;

  RETURN v_new_task_id;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - SINGLE ADMIN ENFORCEMENT
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper function to verify current authenticated user is the active administrator
CREATE OR REPLACE FUNCTION public.is_authenticated_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND id = p_user_id
      AND role = 'admin'
      AND is_active = TRUE
  );
$$;

-- Profiles Policies
CREATE POLICY "Admin can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id AND role = 'admin' AND is_active = TRUE);
CREATE POLICY "Admin can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id AND role = 'admin' AND is_active = TRUE)
  WITH CHECK (auth.uid() = id AND role = 'admin' AND is_active = TRUE);

-- Categories Policies
CREATE POLICY "Admin full access to categories" ON public.categories
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Task Recurrences Policies
CREATE POLICY "Admin full access to task_recurrences" ON public.task_recurrences
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Tasks Policies
CREATE POLICY "Admin full access to tasks" ON public.tasks
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Task Remarks Policies
CREATE POLICY "Admin full access to task_remarks" ON public.task_remarks
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Task Attachments Policies
CREATE POLICY "Admin full access to task_attachments" ON public.task_attachments
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Notifications Policies
CREATE POLICY "Admin full access to notifications" ON public.notifications
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Activity Logs Policies
CREATE POLICY "Admin full access to activity_logs" ON public.activity_logs
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- User Preferences Policies
CREATE POLICY "Admin full access to user_preferences" ON public.user_preferences
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- Push Subscriptions Policies
CREATE POLICY "Admin full access to push_subscriptions" ON public.push_subscriptions
  FOR ALL USING (public.is_authenticated_admin(user_id))
  WITH CHECK (public.is_authenticated_admin(user_id));

-- =============================================================================
-- SUPABASE STORAGE BUCKET & RLS POLICIES (PRIVATE VOICE NOTES BUCKET)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  FALSE,
  26214400, -- 25 MB limit per recording
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin can upload voice notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND public.is_authenticated_admin(auth.uid())
  );

CREATE POLICY "Admin can view own voice notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND public.is_authenticated_admin(auth.uid())
  );

CREATE POLICY "Admin can delete own voice notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND public.is_authenticated_admin(auth.uid())
  );
