import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  Pin,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Plus,
  Search,
  Filter,
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Bell,
  Lock,
  LogOut,
  User,
  Edit3,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Database,
  Sun,
  Moon,
  List,
  Grid,
  Volume2,
  MessageSquare,
  ShieldCheck,
  Repeat,
  FolderPlus,
  Check,
  Copy,
  SlidersHorizontal,
  ArrowUpDown,
  History,
  Sparkles,
  Info,
  KeyRound,
  Server,
  FileText
} from 'lucide-react';

// =============================================================================
// TYPES & INTERFACES (RELATIONAL SCHEMA MIRRORING SUPABASE POSTGRESQL)
// =============================================================================

export type Priority = 'High' | 'Medium' | 'Low';
export type RawTaskStatus = 'pending' | 'completed';
export type ComputedTaskStatus = 'pending' | 'completed' | 'overdue';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';
export type RecurrenceStatus = 'active' | 'paused' | 'stopped';

export type NavSection =
  | 'dashboard'
  | 'all'
  | 'today'
  | 'upcoming'
  | 'pinned'
  | 'calendar'
  | 'completed'
  | 'overdue'
  | 'reports'
  | 'trash'
  | 'settings';

export interface Profile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin';
  last_login_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRemark {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  duration_seconds: number;
  file_size_bytes: number;
  audio_data_url: string; // Signed URL or persistent base64 audio data URI
  created_at: string;
}

export interface TaskRecurrence {
  id: string;
  user_id: string;
  frequency: RecurrenceFrequency;
  interval_value: number;
  custom_unit: 'days' | 'weeks' | 'months';
  weekdays: number[]; // 0=Sun..6=Sat
  month_day: number | null;
  start_date: string;
  end_date: string | null;
  status: RecurrenceStatus;
  last_generated_date: string | null;
  occurrences_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompletionRecord {
  completed_at: string;
  reopened_at?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category_id: string | null;
  task_date: string; // YYYY-MM-DD in Asia/Kolkata
  priority: Priority;
  status: RawTaskStatus;
  is_pinned: boolean;
  is_trashed: boolean;
  trashed_at: string | null;
  completed_at: string | null;
  completion_history: CompletionRecord[];
  recurrence_id: string | null;
  recurrence_occurrence_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  task_id: string | null;
  type: 'upcoming' | 'due_today' | 'overdue' | 'system' | 'recurrence';
  title: string;
  message: string;
  is_read: boolean;
  scheduled_for: string;
  created_at: string;
  dedupe_key: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  task_id: string | null;
  action: string;
  entity_type: 'task' | 'remark' | 'category' | 'voice_note' | 'recurrence' | 'settings' | 'auth';
  details: string;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  custom_dashboard_heading: string;
  theme: 'light' | 'dark';
  default_task_view: 'grid' | 'list';
  timezone: string;
  date_format: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'MMM DD, YYYY';
  notifications_enabled: boolean;
  notify_upcoming: boolean;
  notify_due_today: boolean;
  notify_overdue: boolean;
  reminder_hour_ist: number;
}

export interface SupabaseConfig {
  provider?: 'firebase' | 'supabase';
  firebaseUrl?: string;
  url: string;
  anonKey: string;
  connected: boolean;
  lastVerifiedAt: string | null;
}

// =============================================================================
// TIMEZONE & DATE UTILITIES (STRICTLY ASIA/KOLKATA IST)
// =============================================================================

const IST_TIMEZONE = 'Asia/Kolkata';

export function getTodayIST(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return '2026-10-31';
  }
}

export function formatDateIST(
  dateStr: string | null | undefined,
  format: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'MMM DD, YYYY' = 'DD MMM YYYY'
): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const mon = months[m - 1] || 'Jan';
  if (format === 'YYYY-MM-DD') return `${y}-${mm}-${dd}`;
  if (format === 'MMM DD, YYYY') return `${mon} ${dd}, ${y}`;
  return `${dd} ${mon} ${y}`;
}

export function formatDateTimeIST(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  try {
    const dt = new Date(isoStr);
    if (isNaN(dt.getTime())) return isoStr;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(dt) + ' IST';
  } catch {
    return isoStr;
  }
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = dateB.slice(0, 10).split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
}

/**
 * Dynamic Overdue Status Calculation (Asia/Kolkata):
 * - Completed tasks ALWAYS remain 'completed' (Green), even if due date has passed.
 * - Incomplete tasks become 'overdue' (Red) ONLY after their due date has strictly passed (task_date < todayIST).
 * - Today's incomplete tasks (task_date === todayIST) remain 'pending' (White).
 */
export function computeTaskStatus(task: Task, todayIST: string): ComputedTaskStatus {
  if (task.status === 'completed') {
    return 'completed';
  }
  if (task.task_date < todayIST) {
    return 'overdue';
  }
  return 'pending';
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// SYNTHESIZED WAV VOICE NOTE GENERATOR (FOR INITIAL SEED & SANDBOX FALLBACK)
// =============================================================================

function createSampleWavDataUrl(durationSec = 3, freqHz = 440): string {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin((Math.PI * t) / durationSec);
    const mod = 1 + 0.25 * Math.sin(2 * Math.PI * 3 * t);
    const sample = Math.sin(2 * Math.PI * freqHz * mod * t) * envelope * 0.35;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// =============================================================================
// INITIAL SEED DATA (REALISTIC PERSONAL & PROFESSIONAL ADMIN WORKSPACE)
// =============================================================================

const ADMIN_USER_ID = '00000000-0000-4000-a000-000000000001';

function buildInitialSeed(todayIST: string) {
  const yesterday = addDaysToDateStr(todayIST, -1);
  const threeDaysAgo = addDaysToDateStr(todayIST, -3);
  const fiveDaysAgo = addDaysToDateStr(todayIST, -5);
  const tomorrow = addDaysToDateStr(todayIST, 1);
  const inThreeDays = addDaysToDateStr(todayIST, 3);
  const inSixDays = addDaysToDateStr(todayIST, 6);

  const profile: Profile = {
    id: ADMIN_USER_ID,
    username: 'admin',
    email: 'admin@apextask.internal',
    full_name: 'Vikram Menon (Administrator)',
    role: 'admin',
    last_login_at: new Date().toISOString(),
  };

  const categories: Category[] = [
    { id: 'cat-work', user_id: ADMIN_USER_ID, name: 'Work', color: '#2563EB', icon: 'Briefcase', is_default: true, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-personal', user_id: ADMIN_USER_ID, name: 'Personal', color: '#059669', icon: 'User', is_default: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-content', user_id: ADMIN_USER_ID, name: 'Content Creation', color: '#7C3AED', icon: 'Video', is_default: true, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-business', user_id: ADMIN_USER_ID, name: 'Business', color: '#D97706', icon: 'TrendingUp', is_default: true, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-meetings', user_id: ADMIN_USER_ID, name: 'Meetings', color: '#0891B2', icon: 'Users', is_default: true, sort_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-other', user_id: ADMIN_USER_ID, name: 'Other', color: '#64748B', icon: 'Folder', is_default: true, sort_order: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  const recurrences: TaskRecurrence[] = [
    {
      id: 'rec-weekly-audit',
      user_id: ADMIN_USER_ID,
      frequency: 'weekly',
      interval_value: 1,
      custom_unit: 'weeks',
      weekdays: [1, 5],
      month_day: null,
      start_date: fiveDaysAgo,
      end_date: null,
      status: 'active',
      last_generated_date: todayIST,
      occurrences_count: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'rec-daily-standup',
      user_id: ADMIN_USER_ID,
      frequency: 'daily',
      interval_value: 1,
      custom_unit: 'days',
      weekdays: [],
      month_day: null,
      start_date: threeDaysAgo,
      end_date: null,
      status: 'active',
      last_generated_date: todayIST,
      occurrences_count: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-101',
      user_id: ADMIN_USER_ID,
      title: 'Finalize Q4 Supabase Database & RLS Security Audit',
      description: 'Verify Row Level Security policies across all 10 PostgreSQL tables and confirm private voice-notes bucket signed URL expiration settings.',
      category_id: 'cat-work',
      task_date: todayIST,
      priority: 'High',
      status: 'pending',
      is_pinned: true,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: 'rec-weekly-audit',
      recurrence_occurrence_key: `rec-weekly-audit:${todayIST}`,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-102',
      user_id: ADMIN_USER_ID,
      title: 'Review Daily Priority Backlog & Voice Briefings',
      description: 'Daily administrative check-in on personal and professional deliverables across mobile and desktop.',
      category_id: 'cat-business',
      task_date: todayIST,
      priority: 'Medium',
      status: 'pending',
      is_pinned: false,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: 'rec-daily-standup',
      recurrence_occurrence_key: `rec-daily-standup:${todayIST}`,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-103',
      user_id: ADMIN_USER_ID,
      title: 'Submit GST & Vendor Invoice Reconciliation',
      description: 'Cross-check monthly cloud infrastructure invoices, export XLSX ledger, and upload signed approval.',
      category_id: 'cat-business',
      task_date: yesterday,
      priority: 'High',
      status: 'pending',
      is_pinned: true,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-104',
      user_id: ADMIN_USER_ID,
      title: 'Record Product Architecture Walkthrough Video',
      description: 'Capture 4K screen walkthrough covering Supabase Auth, voice notes, and dynamic IST overdue rules.',
      category_id: 'cat-content',
      task_date: threeDaysAgo,
      priority: 'Medium',
      status: 'pending',
      is_pinned: false,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-105',
      user_id: ADMIN_USER_ID,
      title: 'Deploy Production Vercel Build & Edge Cron Scheduler',
      description: 'Configured vercel.json SPA rewrites, Service Worker push headers, and hourly Supabase cron trigger.',
      category_id: 'cat-work',
      task_date: fiveDaysAgo,
      priority: 'High',
      status: 'completed',
      is_pinned: true,
      is_trashed: false,
      trashed_at: null,
      completed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      completion_history: [{ completed_at: new Date(Date.now() - 86400000 * 2).toISOString() }],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'task-106',
      user_id: ADMIN_USER_ID,
      title: 'Annual Health Checkup & Dental Appointment',
      description: 'Morning blood panel and consultation at Aster Medcity.',
      category_id: 'cat-personal',
      task_date: todayIST,
      priority: 'Low',
      status: 'completed',
      is_pinned: false,
      is_trashed: false,
      trashed_at: null,
      completed_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      completion_history: [{ completed_at: new Date(Date.now() - 3600000 * 3).toISOString() }],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'task-107',
      user_id: ADMIN_USER_ID,
      title: 'Strategy Sync with Mobile Engineering Lead',
      description: 'Review PWA installability on iOS Safari and Android Chrome, plus offline audio blob caching.',
      category_id: 'cat-meetings',
      task_date: tomorrow,
      priority: 'High',
      status: 'pending',
      is_pinned: true,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-108',
      user_id: ADMIN_USER_ID,
      title: 'Publish Monthly Newsletter & Founder Notes',
      description: 'Draft executive summary on personal productivity systems and schedule newsletter dispatch.',
      category_id: 'cat-content',
      task_date: inThreeDays,
      priority: 'Medium',
      status: 'pending',
      is_pinned: false,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-109',
      user_id: ADMIN_USER_ID,
      title: 'Renew Domain SSL Certificates & DNSSEC Keys',
      description: 'Verify Cloudflare DNSSEC DS records and automated TLS renewal.',
      category_id: 'cat-other',
      task_date: inSixDays,
      priority: 'Low',
      status: 'pending',
      is_pinned: false,
      is_trashed: false,
      trashed_at: null,
      completed_at: null,
      completion_history: [],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-110',
      user_id: ADMIN_USER_ID,
      title: 'Archived Legacy Trello Board CSV Migration Draft',
      description: 'Old migration checklist moved to trash after switching exclusively to ApexTask.',
      category_id: 'cat-other',
      task_date: threeDaysAgo,
      priority: 'Low',
      status: 'pending',
      is_pinned: false,
      is_trashed: true,
      trashed_at: new Date(Date.now() - 86400000).toISOString(),
      completed_at: null,
      completion_history: [],
      recurrence_id: null,
      recurrence_occurrence_key: null,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const remarks: TaskRemark[] = [
    {
      id: 'rem-1',
      task_id: 'task-101',
      user_id: ADMIN_USER_ID,
      content: 'UI design and responsive card color system completed.',
      is_edited: false,
      created_at: new Date(Date.now() - 3600000 * 28).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 28).toISOString(),
    },
    {
      id: 'rem-2',
      task_id: 'task-101',
      user_id: ADMIN_USER_ID,
      content: 'Supabase PostgreSQL schema with 10 tables and RLS policies verified.',
      is_edited: false,
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    },
    {
      id: 'rem-3',
      task_id: 'task-101',
      user_id: ADMIN_USER_ID,
      content: 'Discussed private storage bucket signed URL TTL with security reviewer.',
      is_edited: false,
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
      id: 'rem-4',
      task_id: 'task-101',
      user_id: ADMIN_USER_ID,
      content: 'Final end-to-end penetration test remaining before sign-off.',
      is_edited: false,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'rem-5',
      task_id: 'task-103',
      user_id: ADMIN_USER_ID,
      content: 'Collected AWS and Supabase billing statements; waiting on CA confirmation.',
      is_edited: false,
      created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    },
  ];

  const attachments: TaskAttachment[] = [
    {
      id: 'att-1',
      task_id: 'task-101',
      user_id: ADMIN_USER_ID,
      storage_bucket: 'voice-notes',
      storage_path: `${ADMIN_USER_ID}/task-101/voice-briefing.wav`,
      mime_type: 'audio/wav',
      duration_seconds: 4,
      file_size_bytes: 64044,
      audio_data_url: createSampleWavDataUrl(4, 520),
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
  ];

  const preferences: UserPreferences = {
    user_id: ADMIN_USER_ID,
    custom_dashboard_heading: '',
    theme: 'light',
    default_task_view: 'grid',
    timezone: 'Asia/Kolkata',
    date_format: 'DD MMM YYYY',
    notifications_enabled: true,
    notify_upcoming: true,
    notify_due_today: true,
    notify_overdue: true,
    reminder_hour_ist: 9,
  };

  return { profile, categories, recurrences, tasks, remarks, attachments, preferences };
}

// =============================================================================
// SAFE STORAGE HELPER
// =============================================================================

const STORAGE_KEYS = {
  AUTH_SESSION: 'apextask_auth_session_v1',
  ADMIN_CRED: 'apextask_admin_cred_v1',
  TASKS: 'apextask_tasks_v1',
  CATEGORIES: 'apextask_categories_v1',
  REMARKS: 'apextask_remarks_v1',
  ATTACHMENTS: 'apextask_attachments_v1',
  RECURRENCES: 'apextask_recurrences_v1',
  NOTIFICATIONS: 'apextask_notifications_v1',
  PREFERENCES: 'apextask_preferences_v1',
  LOGS: 'apextask_activity_logs_v1',
  SUPABASE_CFG: 'apextask_supabase_cfg_v1',
};

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSave<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or private browsing errors
  }
}

// =============================================================================
// RECURRING NEXT-DATE CALCULATOR (IDEMPOTENT & MISSED-SCHEDULE SAFE)
// =============================================================================

function computeNextOccurrenceDate(
  taskDate: string,
  rec: TaskRecurrence,
  todayIST: string
): string | null {
  if (rec.status !== 'active') return null;
  const baseDate = taskDate > rec.start_date ? taskDate : rec.start_date;
  let nextDate = baseDate;

  if (rec.frequency === 'daily') {
    nextDate = addDaysToDateStr(baseDate, rec.interval_value);
    if (nextDate < todayIST) {
      nextDate = todayIST;
    }
  } else if (rec.frequency === 'weekly') {
    if (rec.weekdays && rec.weekdays.length > 0) {
      for (let i = 1; i <= 14; i++) {
        const candidate = addDaysToDateStr(baseDate, i);
        const [y, m, d] = candidate.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        if (rec.weekdays.includes(dow)) {
          nextDate = candidate;
          break;
        }
      }
    } else {
      nextDate = addDaysToDateStr(baseDate, rec.interval_value * 7);
    }
  } else if (rec.frequency === 'monthly') {
    const [y, m, d] = baseDate.split('-').map(Number);
    const targetMonthIndex = m - 1 + rec.interval_value;
    const targetYear = y + Math.floor(targetMonthIndex / 12);
    const targetMonth = (targetMonthIndex % 12) + 1;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const desiredDay = rec.month_day || d;
    const clampedDay = Math.min(desiredDay, daysInTargetMonth);
    nextDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  } else {
    // custom
    if (rec.custom_unit === 'weeks') {
      nextDate = addDaysToDateStr(baseDate, rec.interval_value * 7);
    } else if (rec.custom_unit === 'months') {
      const [y, m, d] = baseDate.split('-').map(Number);
      const targetMonthIndex = m - 1 + rec.interval_value;
      const targetYear = y + Math.floor(targetMonthIndex / 12);
      const targetMonth = (targetMonthIndex % 12) + 1;
      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
      const clampedDay = Math.min(d, daysInTargetMonth);
      nextDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    } else {
      nextDate = addDaysToDateStr(baseDate, rec.interval_value);
    }
  }

  if (rec.end_date && nextDate > rec.end_date) {
    return null;
  }
  return nextDate;
}

// =============================================================================
// MAIN APPLICATION COMPONENT
// =============================================================================

export default function App() {
  const todayIST = useMemo(() => getTodayIST(), []);
  const seed = useMemo(() => buildInitialSeed(todayIST), [todayIST]);

  // --- Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    safeLoad<boolean>(STORAGE_KEYS.AUTH_SESSION, true)
  );
  const [adminCreds, setAdminCreds] = useState<{ username: string; passwordHash: string }>(() =>
    safeLoad(STORAGE_KEYS.ADMIN_CRED, { username: 'admin', passwordHash: 'Admin@2026' })
  );
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('Admin@2026');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- Built-in Default Firebase Realtime Database (Auto-Connected Across All Devices) ---
  const DEFAULT_FIREBASE_URL = 'https://mytasks-52442-default-rtdb.firebaseio.com';
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => {
    const saved = safeLoad<SupabaseConfig | null>(STORAGE_KEYS.SUPABASE_CFG, null);
    if (saved && saved.firebaseUrl && saved.firebaseUrl.trim().length > 0) {
      return {
        ...saved,
        provider: 'firebase',
        connected: true,
      };
    }
    return {
      provider: 'firebase',
      firebaseUrl: DEFAULT_FIREBASE_URL,
      url: '',
      anonKey: '',
      connected: true,
      lastVerifiedAt: new Date().toISOString(),
    };
  });
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const hasLoadedInitialCloudRef = useRef(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  // --- Relational Data State ---
  const [profile] = useState<Profile>(seed.profile);
  const [categories, setCategories] = useState<Category[]>(() =>
    safeLoad<Category[]>(STORAGE_KEYS.CATEGORIES, seed.categories)
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    safeLoad<Task[]>(STORAGE_KEYS.TASKS, seed.tasks)
  );
  const [remarks, setRemarks] = useState<TaskRemark[]>(() =>
    safeLoad<TaskRemark[]>(STORAGE_KEYS.REMARKS, seed.remarks)
  );
  const [attachments, setAttachments] = useState<TaskAttachment[]>(() =>
    safeLoad<TaskAttachment[]>(STORAGE_KEYS.ATTACHMENTS, seed.attachments)
  );
  const [recurrences, setRecurrences] = useState<TaskRecurrence[]>(() =>
    safeLoad<TaskRecurrence[]>(STORAGE_KEYS.RECURRENCES, seed.recurrences)
  );
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    safeLoad<UserPreferences>(STORAGE_KEYS.PREFERENCES, seed.preferences)
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    safeLoad<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [])
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
    safeLoad<ActivityLog[]>(STORAGE_KEYS.LOGS, [])
  );

  // --- Navigation & View State ---
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => preferences.default_task_view);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // --- Search & Multi-Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | Priority>('all');
  const [filterPinnedOnly, setFilterPinnedOnly] = useState<boolean>(false);
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc' | 'priority' | 'created_desc'>('date_asc');
  const [showFilterBar, setShowFilterBar] = useState<boolean>(false);

  // --- Task Create / Edit Modal State ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<string>('cat-work');
  const [formDate, setFormDate] = useState<string>(todayIST);
  const [formPriority, setFormPriority] = useState<Priority>('Medium');
  const [formPinned, setFormPinned] = useState<boolean>(false);
  const [formEnableRecurrence, setFormEnableRecurrence] = useState<boolean>(false);
  const [formRecFrequency, setFormRecFrequency] = useState<RecurrenceFrequency>('weekly');
  const [formRecInterval, setFormRecInterval] = useState<number>(1);
  const [formRecCustomUnit, setFormRecCustomUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [formRecWeekdays, setFormRecWeekdays] = useState<number[]>([1]);
  const [formRecMonthDay, setFormRecMonthDay] = useState<number>(1);
  const [formRecStartDate, setFormRecStartDate] = useState<string>(todayIST);
  const [formRecEndDate, setFormRecEndDate] = useState<string>('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // --- Voice Recorder State inside Create/Edit Form ---
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'paused' | 'recorded'>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('audio/webm');
  const [recordedSizeBytes, setRecordedSizeBytes] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // --- Task Detail Drawer & Remarks State ---
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkContent, setEditingRemarkContent] = useState('');

  // --- Confirmation Modal State (No window.confirm/alert) ---
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // --- Toast Notification Banner ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const triggerToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // --- Calendar State ---
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [calendarCursorDate, setCalendarCursorDate] = useState<string>(todayIST);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayIST);

  // --- Reports & Export State ---
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('month');
  const [reportDateField, setReportDateField] = useState<'task_date' | 'created_at' | 'completed_at'>('task_date');
  const [reportStartDate, setReportStartDate] = useState<string>(() => addDaysToDateStr(todayIST, -30));
  const [reportEndDate, setReportEndDate] = useState<string>(() => addDaysToDateStr(todayIST, 30));
  const [reportCategory, setReportCategory] = useState<string>('all');
  const [reportStatus, setReportStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [reportPriority, setReportPriority] = useState<'all' | Priority>('all');
  const [reportPinned, setReportPinned] = useState<'all' | 'pinned' | 'unpinned'>('all');

  // --- Settings State ---
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#2563EB');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#2563EB');
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [browserPushPermission, setBrowserPushPermission] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // --- Persist all state changes ---
  useEffect(() => safeSave(STORAGE_KEYS.AUTH_SESSION, isAuthenticated), [isAuthenticated]);
  useEffect(() => safeSave(STORAGE_KEYS.ADMIN_CRED, adminCreds), [adminCreds]);
  useEffect(() => safeSave(STORAGE_KEYS.CATEGORIES, categories), [categories]);
  useEffect(() => safeSave(STORAGE_KEYS.TASKS, tasks), [tasks]);
  useEffect(() => safeSave(STORAGE_KEYS.REMARKS, remarks), [remarks]);
  useEffect(() => safeSave(STORAGE_KEYS.ATTACHMENTS, attachments), [attachments]);
  useEffect(() => safeSave(STORAGE_KEYS.RECURRENCES, recurrences), [recurrences]);
  useEffect(() => safeSave(STORAGE_KEYS.PREFERENCES, preferences), [preferences]);
  useEffect(() => safeSave(STORAGE_KEYS.NOTIFICATIONS, notifications), [notifications]);
  useEffect(() => safeSave(STORAGE_KEYS.LOGS, activityLogs), [activityLogs]);
  useEffect(() => safeSave(STORAGE_KEYS.SUPABASE_CFG, supabaseConfig), [supabaseConfig]);

  const pushStateToFirebase = useCallback(
    async (targetUrl?: string, silent = false) => {
      const rawUrl = (targetUrl ?? supabaseConfig.firebaseUrl ?? '').trim().replace(/\/$/, '');
      if (!rawUrl || !rawUrl.startsWith('https://')) {
        if (!silent) triggerToast('Paste your https://...firebaseio.com or firebasedatabase.app link first.', 'error');
        return false;
      }
      setIsSyncingCloud(true);
      try {
        const endpoint = new URL('/apextask_workspace.json', rawUrl).toString();
        const payload = {
          updatedAt: new Date().toISOString(),
          categories,
          recurrences,
          tasks,
          remarks,
          attachments,
          preferences,
        };
        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setIsSyncingCloud(false);
        if (res.ok) {
          setSupabaseConfig((prev) => ({
            ...prev,
            provider: 'firebase',
            firebaseUrl: rawUrl,
            connected: true,
            lastVerifiedAt: new Date().toISOString(),
          }));
          if (!silent) triggerToast('Synced all tasks, remarks & voice notes to Free Firebase Cloud!', 'success');
          return true;
        } else {
          if (!silent) triggerToast(`Firebase returned HTTP ${res.status}. Make sure Realtime Database is in Test Mode.`, 'error');
          return false;
        }
      } catch {
        setIsSyncingCloud(false);
        if (!silent) triggerToast('Could not reach Firebase URL. Check your link and internet connection.', 'error');
        return false;
      }
    },
    [supabaseConfig.firebaseUrl, categories, recurrences, tasks, remarks, attachments, preferences, triggerToast]
  );

  const pullStateFromFirebase = useCallback(
    async (targetUrl?: string) => {
      const rawUrl = (targetUrl ?? supabaseConfig.firebaseUrl ?? '').trim().replace(/\/$/, '');
      if (!rawUrl || !rawUrl.startsWith('https://')) {
        triggerToast('Paste your https://...firebaseio.com or firebasedatabase.app link first.', 'error');
        return;
      }
      setIsSyncingCloud(true);
      try {
        const endpoint = new URL('/apextask_workspace.json', rawUrl).toString();
        const res = await fetch(endpoint);
        setIsSyncingCloud(false);
        if (!res.ok) {
          triggerToast(`Firebase returned HTTP ${res.status}.`, 'error');
          return;
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.tasks)) {
          // No data in cloud yet — push current local workspace up to initialize it!
          await pushStateToFirebase(rawUrl, false);
          return;
        }
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (Array.isArray(data.remarks)) setRemarks(data.remarks);
        if (Array.isArray(data.attachments)) setAttachments(data.attachments);
        if (Array.isArray(data.recurrences)) setRecurrences(data.recurrences);
        if (data.preferences) setPreferences(data.preferences);
        setSupabaseConfig((prev) => ({
          ...prev,
          provider: 'firebase',
          firebaseUrl: rawUrl,
          connected: true,
          lastVerifiedAt: new Date().toISOString(),
        }));
        triggerToast(`Loaded ${data.tasks.length} tasks from Free Firebase Cloud!`, 'success');
      } catch {
        setIsSyncingCloud(false);
        triggerToast('Network error loading from Firebase.', 'error');
      }
    },
    [supabaseConfig.firebaseUrl, pushStateToFirebase, triggerToast]
  );

  // Auto-load from built-in Firebase URL on initial startup & when switching back to the tab on any device
  useEffect(() => {
    const activeFirebaseUrl = (supabaseConfig.firebaseUrl || DEFAULT_FIREBASE_URL).trim().replace(/\/$/, '');
    if (!activeFirebaseUrl) return;

    let isMounted = true;
    const autoSyncOnOpen = async (silent = true) => {
      try {
        setIsSyncingCloud(true);
        const endpoint = new URL('/apextask_workspace.json', activeFirebaseUrl).toString();
        const res = await fetch(endpoint);
        if (!isMounted) return;
        setIsSyncingCloud(false);
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.tasks)) {
          setCategories(Array.isArray(data.categories) ? data.categories : seed.categories);
          setTasks(data.tasks);
          if (Array.isArray(data.remarks)) setRemarks(data.remarks);
          if (Array.isArray(data.attachments)) setAttachments(data.attachments);
          if (Array.isArray(data.recurrences)) setRecurrences(data.recurrences);
          if (data.preferences) setPreferences(data.preferences);
          hasLoadedInitialCloudRef.current = true;
          if (!silent) triggerToast('Synced latest tasks from Firebase Cloud!', 'success');
        } else {
          // Cloud is empty on first boot — automatically seed Firebase with current tasks
          hasLoadedInitialCloudRef.current = true;
          await pushStateToFirebase(activeFirebaseUrl, true);
        }
      } catch {
        if (isMounted) {
          setIsSyncingCloud(false);
          hasLoadedInitialCloudRef.current = true;
        }
      }
    };

    autoSyncOnOpen(true);

    const handleFocus = () => {
      if (supabaseConfig.connected && supabaseConfig.provider === 'firebase') {
        autoSyncOnOpen(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Auto-sync any local changes to Firebase immediately after initial cloud load completes
  useEffect(() => {
    if (!hasLoadedInitialCloudRef.current) return;
    if (supabaseConfig.connected && supabaseConfig.provider === 'firebase' && supabaseConfig.firebaseUrl) {
      const timer = window.setTimeout(() => {
        pushStateToFirebase(supabaseConfig.firebaseUrl, true);
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [tasks, categories, remarks, attachments, recurrences, preferences, supabaseConfig.connected, supabaseConfig.provider, supabaseConfig.firebaseUrl, pushStateToFirebase]);

  // --- Log Activity Helper ---
  const logActivity = useCallback(
    (action: string, entityType: ActivityLog['entity_type'], taskId: string | null, details: string) => {
      const entry: ActivityLog = {
        id: generateUUID(),
        user_id: ADMIN_USER_ID,
        task_id: taskId,
        action,
        entity_type: entityType,
        details,
        created_at: new Date().toISOString(),
      };
      setActivityLogs((prev) => [entry, ...prev.slice(0, 199)]);
    },
    []
  );

  // --- Synchronize Automated Notifications (Overdue, Due Today, Upcoming Tomorrow) ---
  useEffect(() => {
    if (!preferences.notifications_enabled) return;
    const tomorrowIST = addDaysToDateStr(todayIST, 1);
    const activeTasks = tasks.filter((t) => !t.is_trashed && t.status === 'pending');

    setNotifications((prev) => {
      const existingKeys = new Set(prev.map((n) => n.dedupe_key));
      const additions: AppNotification[] = [];

      for (const t of activeTasks) {
        if (t.task_date < todayIST && preferences.notify_overdue) {
          const key = `${t.id}:overdue:${todayIST}`;
          if (!existingKeys.has(key)) {
            additions.push({
              id: generateUUID(),
              user_id: ADMIN_USER_ID,
              task_id: t.id,
              type: 'overdue',
              title: `Overdue Task: ${t.title}`,
              message: `Due on ${formatDateIST(t.task_date, preferences.date_format)} (${t.priority} Priority)`,
              is_read: false,
              scheduled_for: new Date().toISOString(),
              created_at: new Date().toISOString(),
              dedupe_key: key,
            });
            existingKeys.add(key);
          }
        } else if (t.task_date === todayIST && preferences.notify_due_today) {
          const key = `${t.id}:due_today:${todayIST}`;
          if (!existingKeys.has(key)) {
            additions.push({
              id: generateUUID(),
              user_id: ADMIN_USER_ID,
              task_id: t.id,
              type: 'due_today',
              title: `Due Today: ${t.title}`,
              message: `Scheduled for today (${formatDateIST(t.task_date, preferences.date_format)})`,
              is_read: false,
              scheduled_for: new Date().toISOString(),
              created_at: new Date().toISOString(),
              dedupe_key: key,
            });
            existingKeys.add(key);
          }
        } else if (t.task_date === tomorrowIST && preferences.notify_upcoming) {
          const key = `${t.id}:upcoming:${todayIST}`;
          if (!existingKeys.has(key)) {
            additions.push({
              id: generateUUID(),
              user_id: ADMIN_USER_ID,
              task_id: t.id,
              type: 'upcoming',
              title: `Upcoming Tomorrow: ${t.title}`,
              message: `Scheduled for tomorrow (${formatDateIST(t.task_date, preferences.date_format)})`,
              is_read: false,
              scheduled_for: new Date().toISOString(),
              created_at: new Date().toISOString(),
              dedupe_key: key,
            });
            existingKeys.add(key);
          }
        }
      }
      return additions.length > 0 ? [...additions, ...prev] : prev;
    });
  }, [tasks, todayIST, preferences]);

  // --- Lookup Maps ---
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const remarksByTaskMap = useMemo(() => {
    const map = new Map<string, TaskRemark[]>();
    remarks.forEach((r) => {
      const list = map.get(r.task_id) || [];
      list.push(r);
      map.set(r.task_id, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    );
    return map;
  }, [remarks]);

  const attachmentByTaskMap = useMemo(() => {
    const map = new Map<string, TaskAttachment>();
    attachments.forEach((a) => map.set(a.task_id, a));
    return map;
  }, [attachments]);

  const recurrenceMap = useMemo(() => {
    const map = new Map<string, TaskRecurrence>();
    recurrences.forEach((r) => map.set(r.id, r));
    return map;
  }, [recurrences]);

  // =============================================================================
  // DYNAMIC DASHBOARD STATISTICS (CALCULATED LIVE FROM DATABASE STATE)
  // =============================================================================

  const dashboardStats = useMemo(() => {
    const nonTrashed = tasks.filter((t) => !t.is_trashed);
    const total = nonTrashed.length;
    const todayTasks = nonTrashed.filter((t) => t.task_date === todayIST);
    const completed = nonTrashed.filter((t) => computeTaskStatus(t, todayIST) === 'completed');
    const overdue = nonTrashed.filter((t) => computeTaskStatus(t, todayIST) === 'overdue');
    const pending = nonTrashed.filter((t) => computeTaskStatus(t, todayIST) === 'pending');
    const upcoming = nonTrashed.filter(
      (t) => t.task_date > todayIST && t.status !== 'completed'
    );
    const pinned = nonTrashed.filter((t) => t.is_pinned);
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    // Weekly productivity (last 7 days up to tomorrow)
    const weekStart = addDaysToDateStr(todayIST, -6);
    const weeklyTasks = nonTrashed.filter(
      (t) => t.task_date >= weekStart && t.task_date <= todayIST
    );
    const weeklyCompleted = weeklyTasks.filter((t) => t.status === 'completed').length;
    const weeklyRate =
      weeklyTasks.length > 0 ? Math.round((weeklyCompleted / weeklyTasks.length) * 100) : 0;

    // Monthly productivity (current YYYY-MM)
    const currentMonthPrefix = todayIST.slice(0, 7);
    const monthlyTasks = nonTrashed.filter((t) => t.task_date.startsWith(currentMonthPrefix));
    const monthlyCompleted = monthlyTasks.filter((t) => t.status === 'completed').length;
    const monthlyRate =
      monthlyTasks.length > 0 ? Math.round((monthlyCompleted / monthlyTasks.length) * 100) : 0;

    return {
      total,
      todayCount: todayTasks.length,
      pendingCount: pending.length,
      completedCount: completed.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      pinnedCount: pinned.length,
      trashCount: tasks.filter((t) => t.is_trashed).length,
      completionRate,
      todayTasks,
      upcomingTasks: upcoming.slice().sort((a, b) => a.task_date.localeCompare(b.task_date)),
      pinnedTasks: pinned,
      overdueTasks: overdue,
      weeklyTotal: weeklyTasks.length,
      weeklyCompleted,
      weeklyRate,
      monthlyTotal: monthlyTasks.length,
      monthlyCompleted,
      monthlyRate,
    };
  }, [tasks, todayIST]);

  // =============================================================================
  // AUTHENTICATION HANDLERS
  // =============================================================================

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    const trimmedUser = loginUsername.trim();
    if (!trimmedUser || !loginPassword) {
      setLoginError('Please enter both administrator username and password.');
      setIsLoggingIn(false);
      return;
    }

    // If Live Supabase is configured, authenticate via Supabase RPC + Auth REST API
    if (supabaseConfig.connected && supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        const rpcEndpoint = new URL('/rest/v1/rpc/resolve_admin_username', supabaseConfig.url).toString();
        const rpcRes = await fetch(
          rpcEndpoint,
          {
            method: 'POST',
            headers: {
              apikey: supabaseConfig.anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_username: trimmedUser }),
          }
        );
        const resolvedEmail = rpcRes.ok ? await rpcRes.json() : null;
        const emailToUse = resolvedEmail || trimmedUser;

        const authEndpoint = new URL('/auth/v1/token?grant_type=password', supabaseConfig.url).toString();
        const authRes = await fetch(
          authEndpoint,
          {
            method: 'POST',
            headers: {
              apikey: supabaseConfig.anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: emailToUse, password: loginPassword }),
          }
        );

        if (!authRes.ok) {
          setLoginError('Invalid administrator credentials rejected by Supabase Auth.');
          setIsLoggingIn(false);
          return;
        }
      } catch {
        setLoginError('Network error reaching Supabase Auth endpoint.');
        setIsLoggingIn(false);
        return;
      }
    } else {
      // Verify against single-admin credential store
      if (
        trimmedUser.toLowerCase() !== adminCreds.username.toLowerCase() ||
        loginPassword !== adminCreds.passwordHash
      ) {
        setLoginError('Invalid administrator username or password. Public access is prohibited.');
        setIsLoggingIn(false);
        return;
      }
    }

    setIsAuthenticated(true);
    setIsLoggingIn(false);
    logActivity('Admin Login', 'auth', null, `Administrator (${trimmedUser}) signed in.`);
    triggerToast('Welcome back, Administrator.', 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSelectedTaskId(null);
    logActivity('Admin Logout', 'auth', null, 'Administrator signed out.');
    triggerToast('Signed out securely.', 'info');
  };

  // =============================================================================
  // VOICE RECORDER ENGINE (MEDIARECORDER + PAUSE/RESUME + FALLBACK)
  // =============================================================================

  const clearRecordingTimer = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startVoiceRecording = async () => {
    setMicError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicError(
        'Microphone API is blocked or unavailable in this browser container. You can generate a synthesized voice note below to test audio playback & storage.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          mediaChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        const blob = new Blob(mediaChunksRef.current, { type: mimeType });
        setRecordedSizeBytes(blob.size);
        setRecordedMimeType(mimeType);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setRecordedAudioUrl(reader.result);
            setRecordingStatus('recorded');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setRecordingDuration(0);
      setRecordingStatus('recording');
      clearRecordingTimer();
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setMicError(
        'Microphone permission was denied or no audio input device was found. Please grant microphone access in your browser address bar, or use "Generate Sample Audio Note" below.'
      );
    }
  };

  const pauseOrResumeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording' && typeof rec.pause === 'function') {
      rec.pause();
      clearRecordingTimer();
      setRecordingStatus('paused');
    } else if (rec.state === 'paused' && typeof rec.resume === 'function') {
      rec.resume();
      setRecordingStatus('recording');
      clearRecordingTimer();
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    }
  };

  const stopVoiceRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && (rec.state === 'recording' || rec.state === 'paused')) {
      rec.stop();
    }
  };

  const deleteRecordedVoice = () => {
    clearRecordingTimer();
    setRecordedAudioUrl(null);
    setRecordingDuration(0);
    setRecordedSizeBytes(0);
    setRecordingStatus('idle');
    setMicError(null);
  };

  const generateSampleVoiceNote = () => {
    clearRecordingTimer();
    const wavUrl = createSampleWavDataUrl(4, 480);
    setRecordedAudioUrl(wavUrl);
    setRecordedMimeType('audio/wav');
    setRecordingDuration(4);
    setRecordedSizeBytes(64044);
    setRecordingStatus('recorded');
    setMicError(null);
    triggerToast('Attached 4-second audio briefing note.', 'info');
  };

  // =============================================================================
  // TASK CREATE / EDIT / COMPLETE / TRASH / RESTORE / DELETE ENGINE
  // =============================================================================

  const openCreateTaskModal = (defaultDate?: string) => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategoryId(categories[0]?.id || '');
    setFormDate(defaultDate || todayIST);
    setFormPriority('Medium');
    setFormPinned(false);
    setFormEnableRecurrence(false);
    setFormRecFrequency('weekly');
    setFormRecInterval(1);
    setFormRecCustomUnit('days');
    setFormRecWeekdays([1]);
    setFormRecMonthDay(1);
    setFormRecStartDate(defaultDate || todayIST);
    setFormRecEndDate('');
    deleteRecordedVoice();
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormCategoryId(task.category_id || '');
    setFormDate(task.task_date);
    setFormPriority(task.priority);
    setFormPinned(task.is_pinned);

    const existingRec = task.recurrence_id ? recurrenceMap.get(task.recurrence_id) : null;
    if (existingRec) {
      setFormEnableRecurrence(true);
      setFormRecFrequency(existingRec.frequency);
      setFormRecInterval(existingRec.interval_value);
      setFormRecCustomUnit(existingRec.custom_unit);
      setFormRecWeekdays(existingRec.weekdays || []);
      setFormRecMonthDay(existingRec.month_day || 1);
      setFormRecStartDate(existingRec.start_date);
      setFormRecEndDate(existingRec.end_date || '');
    } else {
      setFormEnableRecurrence(false);
      setFormRecFrequency('weekly');
      setFormRecInterval(1);
      setFormRecCustomUnit('days');
      setFormRecWeekdays([1]);
      setFormRecMonthDay(1);
      setFormRecStartDate(task.task_date);
      setFormRecEndDate('');
    }

    const existingAtt = attachmentByTaskMap.get(task.id);
    if (existingAtt) {
      setRecordedAudioUrl(existingAtt.audio_data_url);
      setRecordedMimeType(existingAtt.mime_type);
      setRecordingDuration(existingAtt.duration_seconds);
      setRecordedSizeBytes(existingAtt.file_size_bytes);
      setRecordingStatus('recorded');
    } else {
      deleteRecordedVoice();
    }

    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTask) return;

    const cleanTitle = formTitle.trim();
    if (!cleanTitle) {
      triggerToast('Task Title is mandatory.', 'error');
      return;
    }
    if (!formDate) {
      triggerToast('Task Date is mandatory.', 'error');
      return;
    }

    setIsSubmittingTask(true);
    const nowIso = new Date().toISOString();
    let recurrenceId: string | null = editingTask?.recurrence_id || null;

    if (formEnableRecurrence) {
      if (recurrenceId && recurrenceMap.has(recurrenceId)) {
        setRecurrences((prev) =>
          prev.map((r) =>
            r.id === recurrenceId
              ? {
                  ...r,
                  frequency: formRecFrequency,
                  interval_value: Math.max(1, Number(formRecInterval) || 1),
                  custom_unit: formRecCustomUnit,
                  weekdays: formRecWeekdays,
                  month_day: formRecFrequency === 'monthly' ? formRecMonthDay : null,
                  start_date: formRecStartDate || formDate,
                  end_date: formRecEndDate || null,
                  updated_at: nowIso,
                }
              : r
          )
        );
      } else {
        recurrenceId = generateUUID();
        const newRec: TaskRecurrence = {
          id: recurrenceId,
          user_id: ADMIN_USER_ID,
          frequency: formRecFrequency,
          interval_value: Math.max(1, Number(formRecInterval) || 1),
          custom_unit: formRecCustomUnit,
          weekdays: formRecWeekdays,
          month_day: formRecFrequency === 'monthly' ? formRecMonthDay : null,
          start_date: formRecStartDate || formDate,
          end_date: formRecEndDate || null,
          status: 'active',
          last_generated_date: formDate,
          occurrences_count: 1,
          created_at: nowIso,
          updated_at: nowIso,
        };
        setRecurrences((prev) => [...prev, newRec]);
      }
    } else {
      recurrenceId = null;
    }

    const taskId = editingTask ? editingTask.id : generateUUID();

    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: cleanTitle,
                description: formDescription.trim(),
                category_id: formCategoryId || null,
                task_date: formDate,
                priority: formPriority,
                is_pinned: formPinned,
                recurrence_id: recurrenceId,
                updated_at: nowIso,
              }
            : t
        )
      );
      logActivity('Updated Task', 'task', taskId, `Edited task "${cleanTitle}"`);
      triggerToast(`Updated task "${cleanTitle}".`, 'success');
    } else {
      const newTask: Task = {
        id: taskId,
        user_id: ADMIN_USER_ID,
        title: cleanTitle,
        description: formDescription.trim(),
        category_id: formCategoryId || null,
        task_date: formDate,
        priority: formPriority,
        status: 'pending',
        is_pinned: formPinned,
        is_trashed: false,
        trashed_at: null,
        completed_at: null,
        completion_history: [],
        recurrence_id: recurrenceId,
        recurrence_occurrence_key: recurrenceId ? `${recurrenceId}:${formDate}` : null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setTasks((prev) => [newTask, ...prev]);
      logActivity('Created Task', 'task', taskId, `Created task "${cleanTitle}" due ${formDate}`);
      triggerToast(`Created task "${cleanTitle}".`, 'success');
    }

    // Handle Voice Note Attachment
    if (recordedAudioUrl) {
      const att: TaskAttachment = {
        id: attachmentByTaskMap.get(taskId)?.id || generateUUID(),
        task_id: taskId,
        user_id: ADMIN_USER_ID,
        storage_bucket: 'voice-notes',
        storage_path: `${ADMIN_USER_ID}/${taskId}/${Date.now()}.webm`,
        mime_type: recordedMimeType,
        duration_seconds: recordingDuration || 1,
        file_size_bytes: recordedSizeBytes || recordedAudioUrl.length,
        audio_data_url: recordedAudioUrl,
        created_at: nowIso,
      };
      setAttachments((prev) => [...prev.filter((a) => a.task_id !== taskId), att]);
    } else {
      setAttachments((prev) => prev.filter((a) => a.task_id !== taskId));
    }

    setIsSubmittingTask(false);
    setIsTaskModalOpen(false);
  };

  const toggleCompleteTask = (task: Task) => {
    const nowIso = new Date().toISOString();

    if (task.status !== 'completed') {
      // Complete Task -> Green card + record completion timestamp + generate next recurring occurrence if active
      const updatedHistory: CompletionRecord[] = [
        ...(task.completion_history || []),
        { completed_at: nowIso },
      ];

      let generatedNextTitle: string | null = null;

      setTasks((prev) => {
        const updatedList = prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'completed' as RawTaskStatus,
                completed_at: nowIso,
                completion_history: updatedHistory,
                updated_at: nowIso,
              }
            : t
        );

        // Check recurrence rule for idempotent next occurrence generation
        if (task.recurrence_id) {
          const rec = recurrenceMap.get(task.recurrence_id);
          if (rec && rec.status === 'active') {
            const nextDate = computeNextOccurrenceDate(task.task_date, rec, todayIST);
            if (nextDate) {
              const occKey = `${rec.id}:${nextDate}`;
              const alreadyExists = updatedList.some(
                (existing) => existing.recurrence_occurrence_key === occKey
              );
              if (!alreadyExists) {
                const nextTask: Task = {
                  id: generateUUID(),
                  user_id: ADMIN_USER_ID,
                  title: task.title,
                  description: task.description,
                  category_id: task.category_id,
                  task_date: nextDate,
                  priority: task.priority,
                  status: 'pending',
                  is_pinned: task.is_pinned,
                  is_trashed: false,
                  trashed_at: null,
                  completed_at: null,
                  completion_history: [],
                  recurrence_id: rec.id,
                  recurrence_occurrence_key: occKey,
                  created_at: nowIso,
                  updated_at: nowIso,
                };
                generatedNextTitle = `${task.title} (${formatDateIST(nextDate, preferences.date_format)})`;
                setRecurrences((rPrev) =>
                  rPrev.map((rItem) =>
                    rItem.id === rec.id
                      ? {
                          ...rItem,
                          last_generated_date: nextDate,
                          occurrences_count: rItem.occurrences_count + 1,
                          updated_at: nowIso,
                        }
                      : rItem
                  )
                );
                return [nextTask, ...updatedList];
              }
            }
          }
        }
        return updatedList;
      });

      logActivity('Completed Task', 'task', task.id, `Marked "${task.title}" completed`);
      if (generatedNextTitle) {
        triggerToast(`Task completed! Next occurrence scheduled: ${generatedNextTitle}`, 'success');
      } else {
        triggerToast(`Completed "${task.title}".`, 'success');
      }
    } else {
      // Reopen Completed Task -> Restore Pending or Overdue dynamically while preserving completion history
      const historyCopy = [...(task.completion_history || [])];
      if (historyCopy.length > 0) {
        historyCopy[historyCopy.length - 1] = {
          ...historyCopy[historyCopy.length - 1],
          reopened_at: nowIso,
        };
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'pending' as RawTaskStatus,
                completed_at: null,
                completion_history: historyCopy,
                updated_at: nowIso,
              }
            : t
        )
      );
      const restoredStatus = task.task_date < todayIST ? 'Overdue' : 'Pending';
      logActivity(
        'Reopened Task',
        'task',
        task.id,
        `Reopened "${task.title}" (Status restored to ${restoredStatus})`
      );
      triggerToast(`Reopened "${task.title}" (${restoredStatus}).`, 'info');
    }
  };

  const togglePinTask = (task: Task) => {
    const nextPinned = !task.is_pinned;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, is_pinned: nextPinned, updated_at: new Date().toISOString() }
          : t
      )
    );
    triggerToast(
      nextPinned ? `Pinned "${task.title}".` : `Unpinned "${task.title}".`,
      'info'
    );
  };

  const requestMoveToTrash = (task: Task) => {
    setConfirmModal({
      title: 'Move Task to Trash?',
      message: `"${task.title}" will be moved to Trash. Its remarks, completion history, and voice notes will be preserved and can be restored anytime.`,
      confirmLabel: 'Move to Trash',
      danger: true,
      onConfirm: () => {
        const nowIso = new Date().toISOString();
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, is_trashed: true, trashed_at: nowIso, updated_at: nowIso }
              : t
          )
        );
        if (selectedTaskId === task.id) setSelectedTaskId(null);
        logActivity('Moved to Trash', 'task', task.id, `Moved "${task.title}" to Trash`);
        triggerToast(`Moved "${task.title}" to Trash.`, 'info');
        setConfirmModal(null);
      },
    });
  };

  const restoreTaskFromTrash = (task: Task) => {
    const nowIso = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, is_trashed: false, trashed_at: null, updated_at: nowIso }
          : t
      )
    );
    logActivity('Restored Task', 'task', task.id, `Restored "${task.title}" from Trash`);
    triggerToast(`Restored "${task.title}".`, 'success');
  };

  const requestPermanentDelete = (task: Task) => {
    setConfirmModal({
      title: 'Permanently Delete Task?',
      message: `Second & Final Confirmation: "${task.title}" and all associated remarks and voice recordings will be permanently erased. This action cannot be undone.`,
      confirmLabel: 'Permanently Delete',
      danger: true,
      onConfirm: () => {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setRemarks((prev) => prev.filter((r) => r.task_id !== task.id));
        setAttachments((prev) => prev.filter((a) => a.task_id !== task.id));
        if (selectedTaskId === task.id) setSelectedTaskId(null);
        logActivity('Permanently Deleted Task', 'task', null, `Deleted "${task.title}" permanently`);
        triggerToast(`Permanently deleted "${task.title}".`, 'info');
        setConfirmModal(null);
      },
    });
  };

  // =============================================================================
  // REMARKS ENGINE (CHRONOLOGICAL, NON-OVERWRITING, EDIT/DELETE WITH CONFIRMATION)
  // =============================================================================

  const handleAddRemark = (taskId: string) => {
    const clean = newRemarkText.trim();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    const remark: TaskRemark = {
      id: generateUUID(),
      task_id: taskId,
      user_id: ADMIN_USER_ID,
      content: clean,
      is_edited: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    setRemarks((prev) => [...prev, remark]);
    setNewRemarkText('');
    logActivity('Added Remark', 'remark', taskId, clean.slice(0, 80));
    triggerToast('Remark added to chronological history.', 'success');
  };

  const handleSaveEditedRemark = (remark: TaskRemark) => {
    const clean = editingRemarkContent.trim();
    if (!clean) return;
    setConfirmModal({
      title: 'Confirm Remark Modification',
      message: 'Update this remark? All other remarks in the task history will remain untouched.',
      confirmLabel: 'Save Remark Edit',
      onConfirm: () => {
        const nowIso = new Date().toISOString();
        setRemarks((prev) =>
          prev.map((r) =>
            r.id === remark.id
              ? { ...r, content: clean, is_edited: true, updated_at: nowIso }
              : r
          )
        );
        setEditingRemarkId(null);
        setEditingRemarkContent('');
        logActivity('Edited Remark', 'remark', remark.task_id, clean.slice(0, 80));
        triggerToast('Remark updated.', 'success');
        setConfirmModal(null);
      },
    });
  };

  const handleDeleteRemark = (remark: TaskRemark) => {
    setConfirmModal({
      title: 'Delete Remark?',
      message: `Are you sure you want to delete this remark ("${remark.content.slice(0, 60)}")? All other remarks on this task will be preserved.`,
      confirmLabel: 'Delete Remark',
      danger: true,
      onConfirm: () => {
        setRemarks((prev) => prev.filter((r) => r.id !== remark.id));
        logActivity('Deleted Remark', 'remark', remark.task_id, remark.content.slice(0, 60));
        triggerToast('Remark deleted.', 'info');
        setConfirmModal(null);
      },
    });
  };

  // =============================================================================
  // RECURRENCE CONTROLS (PAUSE / RESUME / STOP)
  // =============================================================================

  const updateRecurrenceStatus = (recId: string, status: RecurrenceStatus) => {
    setRecurrences((prev) =>
      prev.map((r) =>
        r.id === recId ? { ...r, status, updated_at: new Date().toISOString() } : r
      )
    );
    logActivity('Updated Recurrence', 'recurrence', null, `Recurrence ${recId} set to ${status}`);
    triggerToast(`Recurrence schedule ${status}.`, 'info');
  };

  // =============================================================================
  // FILTERED TASKS FOR ACTIVE NAVIGATION SECTION
  // =============================================================================

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return tasks
      .filter((t) => {
        // Section-level filtering
        if (activeSection === 'trash') {
          if (!t.is_trashed) return false;
        } else {
          if (t.is_trashed) return false;
        }

        const cStatus = computeTaskStatus(t, todayIST);

        if (activeSection === 'today' && t.task_date !== todayIST) return false;
        if (activeSection === 'upcoming' && !(t.task_date > todayIST && cStatus !== 'completed'))
          return false;
        if (activeSection === 'pinned' && !t.is_pinned) return false;
        if (activeSection === 'completed' && cStatus !== 'completed') return false;
        if (activeSection === 'overdue' && cStatus !== 'overdue') return false;

        // Global Search (Title, Description, Category, Remarks)
        if (q) {
          const catName = (t.category_id && categoryMap.get(t.category_id)?.name) || '';
          const taskRems = remarksByTaskMap.get(t.id) || [];
          const matchesTitle = t.title.toLowerCase().includes(q);
          const matchesDesc = t.description.toLowerCase().includes(q);
          const matchesCat = catName.toLowerCase().includes(q);
          const matchesRem = taskRems.some((r) => r.content.toLowerCase().includes(q));
          if (!matchesTitle && !matchesDesc && !matchesCat && !matchesRem) return false;
        }

        // Multi-Filter criteria
        if (filterCategory !== 'all' && t.category_id !== filterCategory) return false;
        if (filterStatus !== 'all' && cStatus !== filterStatus) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        if (filterPinnedOnly && !t.is_pinned) return false;
        if (filterDateStart && t.task_date < filterDateStart) return false;
        if (filterDateEnd && t.task_date > filterDateEnd) return false;

        return true;
      })
      .sort((a, b) => {
        const pRank: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };
        if (sortBy === 'priority') {
          if (pRank[b.priority] !== pRank[a.priority]) return pRank[b.priority] - pRank[a.priority];
          return a.task_date.localeCompare(b.task_date);
        }
        if (sortBy === 'date_desc') return b.task_date.localeCompare(a.task_date);
        if (sortBy === 'created_desc') return b.created_at.localeCompare(a.created_at);
        return a.task_date.localeCompare(b.task_date);
      });
  }, [
    tasks,
    activeSection,
    todayIST,
    searchQuery,
    filterCategory,
    filterStatus,
    filterPriority,
    filterPinnedOnly,
    filterDateStart,
    filterDateEnd,
    sortBy,
    categoryMap,
    remarksByTaskMap,
  ]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterPinnedOnly(false);
    setFilterDateStart('');
    setFilterDateEnd('');
    setSortBy('date_asc');
    triggerToast('Cleared all search and filter criteria.', 'info');
  };

  // =============================================================================
  // REPORTS & EXPORT ENGINE (EXCEL .XLSX WORKBOOK + UTF-8 CSV)
  // =============================================================================

  const reportTasks = useMemo(() => {
    let start = reportStartDate;
    let end = reportEndDate;
    if (reportPeriod === 'today') {
      start = todayIST;
      end = todayIST;
    } else if (reportPeriod === 'week') {
      start = addDaysToDateStr(todayIST, -6);
      end = todayIST;
    } else if (reportPeriod === 'month') {
      start = `${todayIST.slice(0, 7)}-01`;
      end = addDaysToDateStr(todayIST, 31);
    } else if (reportPeriod === 'all') {
      start = '';
      end = '';
    }

    return tasks
      .filter((t) => !t.is_trashed)
      .filter((t) => {
        const cStatus = computeTaskStatus(t, todayIST);
        let compareDate = t.task_date;
        if (reportDateField === 'created_at') {
          compareDate = t.created_at.slice(0, 10);
        } else if (reportDateField === 'completed_at') {
          if (!t.completed_at) return false;
          compareDate = t.completed_at.slice(0, 10);
        }

        if (start && compareDate < start) return false;
        if (end && compareDate > end) return false;
        if (reportCategory !== 'all' && t.category_id !== reportCategory) return false;
        if (reportStatus !== 'all' && cStatus !== reportStatus) return false;
        if (reportPriority !== 'all' && t.priority !== reportPriority) return false;
        if (reportPinned === 'pinned' && !t.is_pinned) return false;
        if (reportPinned === 'unpinned' && t.is_pinned) return false;

        return true;
      })
      .sort((a, b) => a.task_date.localeCompare(b.task_date));
  }, [
    tasks,
    todayIST,
    reportPeriod,
    reportDateField,
    reportStartDate,
    reportEndDate,
    reportCategory,
    reportStatus,
    reportPriority,
    reportPinned,
  ]);

  const reportSummary = useMemo(() => {
    const total = reportTasks.length;
    const completed = reportTasks.filter((t) => computeTaskStatus(t, todayIST) === 'completed').length;
    const overdue = reportTasks.filter((t) => computeTaskStatus(t, todayIST) === 'overdue').length;
    const pending = reportTasks.filter((t) => computeTaskStatus(t, todayIST) === 'pending').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byCategory = categories.map((cat) => {
      const catTasks = reportTasks.filter((t) => t.category_id === cat.id);
      const catCompleted = catTasks.filter((t) => computeTaskStatus(t, todayIST) === 'completed').length;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        count: catTasks.length,
        completed: catCompleted,
      };
    });

    return { total, completed, overdue, pending, rate, byCategory };
  }, [reportTasks, categories, todayIST]);

  const exportToCSV = () => {
    const headers = [
      'Task ID',
      'Task Title',
      'Description',
      'Category',
      'Created Date',
      'Due Date',
      'Status',
      'Priority',
      'Completion Date',
      'Pinned Status',
      'Remarks History',
    ];

    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = reportTasks.map((t) => {
      const cStatus = computeTaskStatus(t, todayIST).toUpperCase();
      const catName = (t.category_id && categoryMap.get(t.category_id)?.name) || 'Uncategorized';
      const rems = (remarksByTaskMap.get(t.id) || [])
        .map((r, i) => `${i + 1}. [${formatDateTimeIST(r.created_at)}] ${r.content}`)
        .join(' | ');

      return [
        t.id,
        t.title,
        t.description || '',
        catName,
        formatDateTimeIST(t.created_at),
        t.task_date,
        cStatus,
        t.priority,
        t.completed_at ? formatDateTimeIST(t.completed_at) : '—',
        t.is_pinned ? 'Pinned' : 'Unpinned',
        rems || 'None',
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ApexTask_Report_${todayIST}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logActivity('Exported CSV Report', 'settings', null, `Exported ${reportTasks.length} tasks to CSV`);
    triggerToast(`Downloaded UTF-8 CSV report (${reportTasks.length} tasks).`, 'success');
  };

  const exportToExcel = () => {
    const escXml = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const summaryRowsXml = `
      <Row><Cell ss:StyleID="Title"><Data ss:Type="String">ApexTask — Executive Productivity &amp; Task Summary Report</Data></Cell></Row>
      <Row><Cell ss:StyleID="Sub"><Data ss:Type="String">Generated on ${escXml(formatDateTimeIST(new Date().toISOString()))} (Asia/Kolkata)</Data></Cell></Row>
      <Row/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Metric</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row><Cell ss:StyleID="Cell"><Data ss:Type="String">Total Filtered Tasks</Data></Cell><Cell ss:StyleID="CellNum"><Data ss:Type="Number">${reportSummary.total}</Data></Cell></Row>
      <Row><Cell ss:StyleID="Cell"><Data ss:Type="String">Completed Tasks</Data></Cell><Cell ss:StyleID="CellNum"><Data ss:Type="Number">${reportSummary.completed}</Data></Cell></Row>
      <Row><Cell ss:StyleID="Cell"><Data ss:Type="String">Pending Tasks</Data></Cell><Cell ss:StyleID="CellNum"><Data ss:Type="Number">${reportSummary.pending}</Data></Cell></Row>
      <Row><Cell ss:StyleID="Cell"><Data ss:Type="String">Overdue Tasks</Data></Cell><Cell ss:StyleID="CellNum"><Data ss:Type="Number">${reportSummary.overdue}</Data></Cell></Row>
      <Row><Cell ss:StyleID="Cell"><Data ss:Type="String">Completion Rate (%)</Data></Cell><Cell ss:StyleID="CellNum"><Data ss:Type="Number">${reportSummary.rate}</Data></Cell></Row>
      <Row/>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Category Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Tasks</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Completed Tasks</Data></Cell>
      </Row>
      ${reportSummary.byCategory
        .map(
          (c) => `
        <Row>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(c.name)}</Data></Cell>
          <Cell ss:StyleID="CellNum"><Data ss:Type="Number">${c.count}</Data></Cell>
          <Cell ss:StyleID="CellNum"><Data ss:Type="Number">${c.completed}</Data></Cell>
        </Row>`
        )
        .join('')}
    `;

    const detailRowsXml = reportTasks
      .map((t) => {
        const cStatus = computeTaskStatus(t, todayIST).toUpperCase();
        const catName = (t.category_id && categoryMap.get(t.category_id)?.name) || 'Uncategorized';
        const rems = (remarksByTaskMap.get(t.id) || [])
          .map((r, i) => `${i + 1}. [${formatDateTimeIST(r.created_at)}] ${r.content}`)
          .join(' | ');
        const statusStyle =
          cStatus === 'COMPLETED'
            ? 'StatusCompleted'
            : cStatus === 'OVERDUE'
            ? 'StatusOverdue'
            : 'Cell';

        return `
        <Row>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(t.id)}</Data></Cell>
          <Cell ss:StyleID="CellBold"><Data ss:Type="String">${escXml(t.title)}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(t.description || '')}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(catName)}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(formatDateTimeIST(t.created_at))}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(t.task_date)}</Data></Cell>
          <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${escXml(cStatus)}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(t.priority)}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(t.completed_at ? formatDateTimeIST(t.completed_at) : '—')}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${t.is_pinned ? 'Pinned' : 'Unpinned'}</Data></Cell>
          <Cell ss:StyleID="Cell"><Data ss:Type="String">${escXml(rems || 'None')}</Data></Cell>
        </Row>`;
      })
      .join('');

    const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/></Style>
  <Style ss:ID="Sub"><Font ss:Italic="1" ss:Size="10" ss:Color="#475569"/></Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
  <Style ss:ID="CellBold"><Font ss:Bold="1"/><Alignment ss:Vertical="Top"/></Style>
  <Style ss:ID="CellNum"><Alignment ss:Horizontal="Right" ss:Vertical="Top"/></Style>
  <Style ss:ID="StatusCompleted"><Font ss:Bold="1" ss:Color="#065F46"/><Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusOverdue"><Font ss:Bold="1" ss:Color="#991B1B"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Summary Sheet">
  <Table>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   ${summaryRowsXml}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Task Details">
  <Table>
   <Column ss:Width="110"/>
   <Column ss:Width="220"/>
   <Column ss:Width="260"/>
   <Column ss:Width="130"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="150"/>
   <Column ss:Width="95"/>
   <Column ss:Width="320"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Task ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Task Title</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Created Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Due Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Priority</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Completion Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pinned Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Remarks History</Data></Cell>
   </Row>
   ${detailRowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ApexTask_Report_${todayIST}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logActivity('Exported Excel Report', 'settings', null, `Exported ${reportTasks.length} tasks to Excel`);
    triggerToast(`Downloaded Excel workbook with Summary & Task Details sheets.`, 'success');
  };

  // =============================================================================
  // BACKUP & RESTORE JSON
  // =============================================================================

  const handleExportFullBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      timezone: IST_TIMEZONE,
      profile,
      categories,
      recurrences,
      tasks,
      remarks,
      attachments,
      preferences,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ApexTask_Full_Backup_${todayIST}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Full JSON database backup downloaded.', 'success');
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.categories)) {
          triggerToast('Invalid backup file structure.', 'error');
          return;
        }
        setCategories(parsed.categories);
        setTasks(parsed.tasks);
        if (Array.isArray(parsed.remarks)) setRemarks(parsed.remarks);
        if (Array.isArray(parsed.attachments)) setAttachments(parsed.attachments);
        if (Array.isArray(parsed.recurrences)) setRecurrences(parsed.recurrences);
        if (parsed.preferences) setPreferences(parsed.preferences);
        logActivity('Restored Full Backup', 'settings', null, `Restored ${parsed.tasks.length} tasks from backup`);
        triggerToast(`Restored ${parsed.tasks.length} tasks and ${parsed.categories.length} categories.`, 'success');
      } catch {
        triggerToast('Failed to parse backup JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // =============================================================================
  // RENDER LOGIN GATE IF UNAUTHENTICATED
  // =============================================================================

  const isDark = preferences.theme === 'dark';

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md rounded-2xl border p-8 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ApexTask Admin</h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Single-Administrator Personal Task Management
              </p>
            </div>
          </div>

          <div className={`mb-5 p-3.5 rounded-xl border text-xs leading-relaxed ${isDark ? 'bg-slate-800/70 border-slate-700 text-slate-300' : 'bg-blue-50/70 border-blue-200 text-slate-700'}`}>
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Protected Administrator Route
            </div>
            Public signup is disabled. Default Admin Username: <code className="font-mono font-bold">admin</code> | Password: <code className="font-mono font-bold">{adminCreds.passwordHash}</code>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-slate-400">
                Admin Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-slate-400">
                Admin Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-sm"
            >
              <KeyRound className="w-4 h-4" />
              {isLoggingIn ? 'Verifying Session...' : 'Sign In to Admin Workspace'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setLoginUsername(adminCreds.username);
                setLoginPassword(adminCreds.passwordHash);
                setLoginError(null);
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Auto-fill Admin Credentials
            </button>
            <button
              type="button"
              onClick={() => setShowSupabaseModal(true)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> Supabase Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // REUSABLE TASK CARD COMPONENT (STRICT COLOR SYSTEM: WHITE / GREEN / RED)
  // =============================================================================

  const renderTaskCard = (task: Task) => {
    const cStatus = computeTaskStatus(task, todayIST);
    const cat = task.category_id ? categoryMap.get(task.category_id) : null;
    const taskRemarks = remarksByTaskMap.get(task.id) || [];
    const voiceAtt = attachmentByTaskMap.get(task.id);
    const rec = task.recurrence_id ? recurrenceMap.get(task.recurrence_id) : null;
    const overdueDays = cStatus === 'overdue' ? diffDays(todayIST, task.task_date) : 0;

    // Strict Visual Status Color System
    let cardSurface = isDark
      ? 'bg-slate-900 border-slate-800 text-slate-100 hover:border-slate-700'
      : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300';
    let statusBadgeStyle = isDark
      ? 'bg-slate-800 text-slate-300 border-slate-700'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    let statusDotColor = 'bg-slate-400';
    let statusLabel = 'Pending';

    if (cStatus === 'completed') {
      cardSurface = isDark
        ? 'bg-emerald-950/40 border-emerald-700/80 text-emerald-50 hover:border-emerald-600'
        : 'bg-emerald-50/90 border-emerald-300 text-slate-900 hover:border-emerald-400';
      statusBadgeStyle = isDark
        ? 'bg-emerald-900/70 text-emerald-200 border-emerald-700'
        : 'bg-emerald-100 text-emerald-800 border-emerald-300';
      statusDotColor = 'bg-emerald-500';
      statusLabel = 'Completed';
    } else if (cStatus === 'overdue') {
      cardSurface = isDark
        ? 'bg-rose-950/45 border-rose-700/80 text-rose-50 hover:border-rose-600'
        : 'bg-rose-50/90 border-rose-300 text-slate-900 hover:border-rose-400';
      statusBadgeStyle = isDark
        ? 'bg-rose-900/70 text-rose-200 border-rose-700'
        : 'bg-rose-100 text-rose-800 border-rose-300';
      statusDotColor = 'bg-rose-500';
      statusLabel = `Overdue (${overdueDays}d)`;
    }

    const priorityStyle =
      task.priority === 'High'
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20'
        : task.priority === 'Medium'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
        : 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20';

    return (
      <div
        key={task.id}
        onClick={() => setSelectedTaskId(task.id)}
        className={`group rounded-2xl border p-4 transition-all shadow-sm cursor-pointer flex flex-col justify-between ${cardSurface}`}
      >
        <div>
          {/* Top Metadata Row */}
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyle}`}>
                <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
                {statusLabel}
              </span>

              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityStyle}`}>
                {task.priority}
              </span>

              {cat && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: `${cat.color}15`,
                    color: cat.color,
                    borderColor: `${cat.color}35`,
                  }}
                >
                  {cat.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {!task.is_trashed && (
                <button
                  type="button"
                  onClick={() => togglePinTask(task)}
                  title={task.is_pinned ? 'Unpin Task' : 'Pin Important Task'}
                  className={`p-1.5 rounded-lg transition ${
                    task.is_pinned
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Task Title */}
          <h3 className={`font-semibold text-base leading-snug mb-1.5 ${cStatus === 'completed' ? 'line-through opacity-85' : ''}`}>
            {task.title}
          </h3>

          {/* Optional Description Snippet */}
          {task.description && (
            <p className={`text-xs line-clamp-2 mb-3 ${isDark ? 'text-slate-300/80' : 'text-slate-600'}`}>
              {task.description}
            </p>
          )}
        </div>

        <div className="pt-3 mt-1 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 font-medium">
              <CalendarIcon className="w-3.5 h-3.5 opacity-75" />
              {formatDateIST(task.task_date, preferences.date_format)}
              {task.task_date === todayIST && cStatus !== 'completed' && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-blue-600 text-white text-[10px] font-semibold">
                  TODAY
                </span>
              )}
            </span>

            {voiceAtt && (
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium" title="Voice Note Attached">
                <Volume2 className="w-3.5 h-3.5" /> {voiceAtt.duration_seconds}s
              </span>
            )}

            {taskRemarks.length > 0 && (
              <span className="inline-flex items-center gap-1 opacity-75" title="Remarks Count">
                <MessageSquare className="w-3.5 h-3.5" /> {taskRemarks.length}
              </span>
            )}

            {rec && rec.status === 'active' && (
              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium" title={`Recurring ${rec.frequency}`}>
                <Repeat className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* Completion Date or Quick Action Buttons */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {cStatus === 'completed' && task.completed_at && (
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium mr-1">
                Done {formatDateIST(task.completed_at.slice(0, 10), preferences.date_format)}
              </span>
            )}

            {!task.is_trashed ? (
              <>
                <button
                  type="button"
                  onClick={() => toggleCompleteTask(task)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    cStatus === 'completed'
                      ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  }`}
                >
                  {cStatus === 'completed' ? (
                    <>
                      <RotateCcw className="w-3 h-3" /> Reopen
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" /> Complete
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openEditTaskModal(task)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Edit Task"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => requestMoveToTrash(task)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => restoreTaskFromTrash(task)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
                <button
                  type="button"
                  onClick={() => requestPermanentDelete(task)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete Forever
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // =============================================================================
  // NAVIGATION ITEMS
  // =============================================================================

  const navItems: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'all', label: 'All Tasks', icon: CheckSquare, badge: dashboardStats.total },
    { id: 'today', label: "Today's Tasks", icon: Clock, badge: dashboardStats.todayCount },
    { id: 'upcoming', label: 'Upcoming Tasks', icon: CalendarIcon, badge: dashboardStats.upcomingCount },
    { id: 'pinned', label: 'Pinned Tasks', icon: Pin, badge: dashboardStats.pinnedCount },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'completed', label: 'Completed Tasks', icon: CheckCircle2, badge: dashboardStats.completedCount, badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
    { id: 'overdue', label: 'Overdue Tasks', icon: AlertCircle, badge: dashboardStats.overdueCount, badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'trash', label: 'Trash', icon: Trash2, badge: dashboardStats.trashCount },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) || null : null;

  // =============================================================================
  // CALENDAR HELPERS
  // =============================================================================

  const calendarDays = useMemo(() => {
    const [y, m, d] = calendarCursorDate.split('-').map(Number);
    if (calendarMode === 'week') {
      const curr = new Date(Date.UTC(y, m - 1, d));
      const dow = curr.getUTCDay();
      const sunday = addDaysToDateStr(calendarCursorDate, -dow);
      return Array.from({ length: 7 }, (_, idx) => {
        const dateStr = addDaysToDateStr(sunday, idx);
        return { dateStr, inMonth: true };
      });
    }

    const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1));
    const startDow = firstDayOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: { dateStr: string; inMonth: boolean }[] = [];

    const firstCellDate = addDaysToDateStr(`${y}-${String(m).padStart(2, '0')}-01`, -startDow);
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dateStr = addDaysToDateStr(firstCellDate, i);
      const inMonth = Number(dateStr.slice(5, 7)) === m;
      cells.push({ dateStr, inMonth });
    }
    return cells;
  }, [calendarCursorDate, calendarMode]);

  const tasksByDateMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks
      .filter((t) => !t.is_trashed)
      .forEach((t) => {
        const list = map.get(t.task_date) || [];
        list.push(t);
        map.set(t.task_date, list);
      });
    return map;
  }, [tasks]);

  // =============================================================================
  // MAIN LAYOUT RENDER
  // =============================================================================

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-lg flex items-center gap-2.5 text-xs font-medium bg-slate-900 text-white border-slate-700">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <aside className={`hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">ApexTask</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Admin Productivity</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openCreateTaskModal()}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            title="Quick Add Task"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Backend Status & Admin Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className={`w-full p-2.5 rounded-xl border text-left text-xs flex items-center justify-between transition ${
              supabaseConfig.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : isDark
                ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 font-medium truncate">
              <Database className="w-3.5 h-3.5 shrink-0 text-blue-500" />
              {supabaseConfig.connected
                ? supabaseConfig.provider === 'firebase'
                  ? 'Firebase Cloud Live (Free)'
                  : 'Supabase Cloud Live'
                : 'Free Cloud Sync / Setup'}
            </span>
            <span className="text-[10px] underline opacity-80">Setup</span>
          </button>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">
                VM
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold truncate">{adminCreds.username}</div>
                <div className="text-[10px] text-slate-500">Asia/Kolkata (IST)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Top Header */}
        <header className={`sticky top-0 z-30 border-b px-4 lg:px-8 py-3.5 flex items-center justify-between gap-3 backdrop-blur-md ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-bold truncate">
                {activeSection === 'dashboard' && preferences.custom_dashboard_heading.trim()
                  ? preferences.custom_dashboard_heading
                  : navItems.find((n) => n.id === activeSection)?.label || 'Dashboard'}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Today in IST: {formatDateIST(todayIST, preferences.date_format)}
              </p>
            </div>
          </div>

          {/* Global Search & Header Actions */}
          <div className="flex items-center gap-2 flex-1 max-w-xl justify-end">
            <div className="relative flex-1 max-w-xs hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeSection === 'dashboard' || activeSection === 'settings' || activeSection === 'reports') {
                    setActiveSection('all');
                  }
                }}
                placeholder="Search title, remarks, category..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilterBar((prev) => !prev)}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${
                showFilterBar
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
              title="Toggle Search & Multi-Filters"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden md:inline">Filters</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPreferences((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))
              }
              className={`p-2 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-white border-slate-200 text-slate-700'}`}
              title="Toggle Light / Dark Mode"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setShowNotificationsDrawer(true)}
              className={`relative p-2 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
              title="Notifications & Reminders"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSupabaseModal(true)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-sm shrink-0 ${
                supabaseConfig.connected
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
              }`}
              title="Open Free Cloud Sync Setup"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{supabaseConfig.connected ? 'Cloud Connected' : 'Free Cloud Sync'}</span>
            </button>

            <button
              type="button"
              onClick={() => openCreateTaskModal()}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
        </header>

        {/* Collapsible Global Search & Multi-Filter Bar */}
        {showFilterBar && (
          <div className={`border-b px-4 lg:px-8 py-3.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 items-end">
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Keyword Search (Title, Desc, Remarks)</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search..."
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending (White)</option>
                  <option value="completed">Completed (Green)</option>
                  <option value="overdue">Overdue (Red)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                >
                  <option value="all">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">From Date</label>
                <input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">To Date</label>
                <input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterPinnedOnly}
                    onChange={(e) => setFilterPinnedOnly(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Pinned Tasks Only</span>
                </label>

                <div className="flex items-center gap-1.5 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className={`px-2 py-1 rounded border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
                  >
                    <option value="date_asc">Due Date (Earliest First)</option>
                    <option value="date_desc">Due Date (Latest First)</option>
                    <option value="priority">Priority (High → Low)</option>
                    <option value="created_desc">Recently Created</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-xs font-semibold"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Body Content Router */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* =============================================================== */}
          {/* 1. DASHBOARD SECTION                                            */}
          {/* =============================================================== */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Quick Cloud Sync Banner (Always visible on all screen sizes) */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${
                supabaseConfig.connected
                  ? isDark
                    ? 'bg-emerald-950/30 border-emerald-800/80'
                    : 'bg-emerald-50/80 border-emerald-200'
                  : isDark
                  ? 'bg-blue-950/30 border-blue-800/80'
                  : 'bg-blue-50/80 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                    supabaseConfig.connected ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">
                      {supabaseConfig.connected
                        ? `Auto-Sync Active: ${supabaseConfig.firebaseUrl || DEFAULT_FIREBASE_URL}`
                        : 'Sync Your Tasks Across Phone & Laptop for Free (No Coding Needed)'}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      {supabaseConfig.connected
                        ? 'Your Firebase link is permanently built into the app — every phone & laptop syncs automatically on open.'
                        : 'Click "Free Cloud Sync Setup" to manage your cloud connection.'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSupabaseModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{supabaseConfig.connected ? 'Manage Cloud Sync' : 'Free Cloud Sync Setup'}</span>
                </button>
              </div>

              {/* 6 Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <button
                  type="button"
                  onClick={() => setActiveSection('all')}
                  className={`p-4 rounded-2xl border text-left transition shadow-sm ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs text-slate-500 font-medium mb-1">Total Tasks</div>
                  <div className="text-2xl font-bold">{dashboardStats.total}</div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">All active items</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('today')}
                  className={`p-4 rounded-2xl border text-left transition shadow-sm ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs text-slate-500 font-medium mb-1">Today's Tasks</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{dashboardStats.todayCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Due {formatDateIST(todayIST, 'DD MMM YYYY')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('pending');
                    setActiveSection('all');
                  }}
                  className={`p-4 rounded-2xl border text-left transition shadow-sm ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs text-slate-500 font-medium mb-1">Pending Tasks</div>
                  <div className="text-2xl font-bold">{dashboardStats.pendingCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1">White status cards</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('completed')}
                  className={`p-4 rounded-2xl border text-left transition shadow-sm ${isDark ? 'bg-emerald-950/30 border-emerald-800/70' : 'bg-emerald-50/70 border-emerald-200'}`}
                >
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mb-1">Completed</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{dashboardStats.completedCount}</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">{dashboardStats.completionRate}% completion rate</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('overdue')}
                  className={`p-4 rounded-2xl border text-left transition shadow-sm ${isDark ? 'bg-rose-950/30 border-rose-800/70' : 'bg-rose-50/70 border-rose-200'}`}
                >
                  <div className="text-xs text-rose-700 dark:text-rose-300 font-medium mb-1">Overdue Tasks</div>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{dashboardStats.overdueCount}</div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">Past due &amp; incomplete</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('upcoming')}
                  className={`p-4 rounded-2xl border text-left transition shadow-sm ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs text-slate-500 font-medium mb-1">Upcoming</div>
                  <div className="text-2xl font-bold">{dashboardStats.upcomingCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Scheduled ahead</div>
                </button>
              </div>

              {/* Completion Progress & Weekly/Monthly Productivity Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Task Completion</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{dashboardStats.completionRate}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${dashboardStats.completionRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {dashboardStats.completedCount} of {dashboardStats.total} total tasks completed across all categories.
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Weekly Productivity (7d)</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{dashboardStats.weeklyRate}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
                    <div
                      className="h-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${dashboardStats.weeklyRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {dashboardStats.weeklyCompleted} completed out of {dashboardStats.weeklyTotal} tasks scheduled in the last 7 days.
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Productivity ({todayIST.slice(0, 7)})</span>
                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{dashboardStats.monthlyRate}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
                    <div
                      className="h-full bg-purple-600 transition-all duration-500"
                      style={{ width: `${dashboardStats.monthlyRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {dashboardStats.monthlyCompleted} completed out of {dashboardStats.monthlyTotal} tasks scheduled this month.
                  </p>
                </div>
              </div>

              {/* Overdue Alert Strip if any */}
              {dashboardStats.overdueTasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4" /> Overdue Tasks Requiring Immediate Action ({dashboardStats.overdueTasks.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('overdue')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View All Overdue →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardStats.overdueTasks.slice(0, 3).map(renderTaskCard)}
                  </div>
                </div>
              )}

              {/* Today's Tasks Overview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" /> Today's Tasks Overview ({dashboardStats.todayTasks.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => openCreateTaskModal(todayIST)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    + Add Task for Today
                  </button>
                </div>
                {dashboardStats.todayTasks.length === 0 ? (
                  <div className={`p-6 rounded-2xl border text-center text-xs text-slate-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    No tasks scheduled for today ({formatDateIST(todayIST, preferences.date_format)}).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardStats.todayTasks.map(renderTaskCard)}
                  </div>
                )}
              </div>

              {/* Pinned Important Tasks & Upcoming Tasks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      <Pin className="w-4 h-4 text-amber-500" /> Pinned Important Tasks ({dashboardStats.pinnedTasks.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('pinned')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      See All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5">
                    {dashboardStats.pinnedTasks.slice(0, 3).map(renderTaskCard)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-blue-600" /> Upcoming Tasks ({dashboardStats.upcomingTasks.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('upcoming')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      See All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5">
                    {dashboardStats.upcomingTasks.slice(0, 3).map(renderTaskCard)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TASK LISTING SECTIONS (ALL, TODAY, UPCOMING, PINNED, COMPLETED, OVERDUE, TRASH) */}
          {/* =============================================================== */}
          {['all', 'today', 'upcoming', 'pinned', 'completed', 'overdue', 'trash'].includes(activeSection) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-800 dark:text-slate-100">{filteredTasks.length}</span> task(s)
                  {activeSection === 'trash' && ' in Trash (restore or permanently delete)'}
                </div>

                <div className="flex items-center gap-2">
                  <div className={`inline-flex rounded-xl border p-0.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${
                        viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" /> Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${
                        viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" /> List
                    </button>
                  </div>
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className={`p-12 rounded-2xl border text-center space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <CheckSquare className="w-10 h-10 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold">No matching tasks in this section</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {activeSection === 'trash'
                      ? 'Trash is currently empty. Deleted tasks move here first before permanent removal.'
                      : 'Create a new task or adjust your active filters to see more tasks.'}
                  </p>
                  {activeSection !== 'trash' && (
                    <button
                      type="button"
                      onClick={() => openCreateTaskModal()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Create New Task
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'flex flex-col gap-3'
                  }
                >
                  {filteredTasks.map(renderTaskCard)}
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 6. CALENDAR VIEW SECTION (MONTH & WEEK VIEW)                    */}
          {/* =============================================================== */}
          {activeSection === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`lg:col-span-2 p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {/* Calendar Header Controls */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarCursorDate((prev) =>
                          addDaysToDateStr(prev, calendarMode === 'month' ? -30 : -7)
                        )
                      }
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-base font-bold min-w-[140px] text-center">
                      {formatDateIST(calendarCursorDate, 'MMM DD, YYYY').replace(/ \d{2},/, '')}
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarCursorDate((prev) =>
                          addDaysToDateStr(prev, calendarMode === 'month' ? 30 : 7)
                        )
                      }
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarCursorDate(todayIST);
                        setSelectedCalendarDate(todayIST);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      Today
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCalendarMode('month')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        calendarMode === 'month'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Month View
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMode('week')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        calendarMode === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Week View
                    </button>
                  </div>
                </div>

                {/* Day-of-week Headings */}
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar Grid Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map(({ dateStr, inMonth }) => {
                    const dayTasks = tasksByDateMap.get(dateStr) || [];
                    const isSelected = selectedCalendarDate === dateStr;
                    const isToday = dateStr === todayIST;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedCalendarDate(dateStr)}
                        className={`min-h-[76px] sm:min-h-[92px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition ${
                          isSelected
                            ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                            : isDark
                            ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                            : 'border-slate-200/80 bg-white hover:border-slate-300'
                        } ${!inMonth ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                              isToday
                                ? 'bg-blue-600 text-white'
                                : ''
                            }`}
                          >
                            {Number(dateStr.slice(8, 10))}
                          </span>
                          {dayTasks.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-400">
                              {dayTasks.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 w-full overflow-hidden mt-1">
                          {dayTasks.slice(0, 2).map((t) => {
                            const st = computeTaskStatus(t, todayIST);
                            const pillClass =
                              st === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                                : st === 'overdue'
                                ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/30'
                                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200';
                            return (
                              <div
                                key={t.id}
                                className={`truncate text-[10px] px-1.5 py-0.5 rounded border font-medium ${pillClass}`}
                              >
                                {t.title}
                              </div>
                            );
                          })}
                          {dayTasks.length > 2 && (
                            <div className="text-[10px] text-slate-400 pl-1">
                              +{dayTasks.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Date Tasks Sidebar */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Selected Date</div>
                      <h3 className="text-base font-bold">
                        {formatDateIST(selectedCalendarDate, preferences.date_format)}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateTaskModal(selectedCalendarDate)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add on Date
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                    {(tasksByDateMap.get(selectedCalendarDate) || []).length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-500">
                        No tasks scheduled for {formatDateIST(selectedCalendarDate, preferences.date_format)}.
                      </div>
                    ) : (
                      (tasksByDateMap.get(selectedCalendarDate) || []).map(renderTaskCard)
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 9. REPORTS & EXPORT SECTION                                     */}
          {/* =============================================================== */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              {/* Filter & Period Controls */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-base font-bold">Reports &amp; Data Export Engine</h2>
                    <p className="text-xs text-slate-500">
                      Filter tasks by period, date field, category, priority, or status and export as multi-sheet Excel (.xlsx) or UTF-8 CSV.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={exportToExcel}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Download Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={exportToCSV}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-4 h-4" /> Download CSV (.csv)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Report Period</label>
                    <select
                      value={reportPeriod}
                      onChange={(e) => setReportPeriod(e.target.value as typeof reportPeriod)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                    >
                      <option value="today">Today ({todayIST})</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="custom">Custom Date Range</option>
                      <option value="all">All Tasks</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Control Date Field</label>
                    <select
                      value={reportDateField}
                      onChange={(e) => setReportDateField(e.target.value as typeof reportDateField)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                    >
                      <option value="task_date">Task Due Date</option>
                      <option value="created_at">Created Date</option>
                      <option value="completed_at">Completed Date</option>
                    </select>
                  </div>

                  {reportPeriod === 'custom' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Start Date</label>
                        <input
                          type="date"
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">End Date</label>
                        <input
                          type="date"
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Category</label>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Status</label>
                    <select
                      value={reportStatus}
                      onChange={(e) => setReportStatus(e.target.value as typeof reportStatus)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Priority</label>
                    <select
                      value={reportPriority}
                      onChange={(e) => setReportPriority(e.target.value as typeof reportPriority)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                    >
                      <option value="all">All Priorities</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase mb-1 text-slate-500">Pinned Filter</label>
                    <select
                      value={reportPinned}
                      onChange={(e) => setReportPinned(e.target.value as typeof reportPinned)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                    >
                      <option value="all">Pinned &amp; Unpinned</option>
                      <option value="pinned">Pinned Only</option>
                      <option value="unpinned">Unpinned Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Report Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="text-xs text-slate-500">Total Tasks</div>
                  <div className="text-2xl font-bold mt-1">{reportSummary.total}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-emerald-950/30 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">Completed</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">{reportSummary.completed}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="text-xs text-slate-500">Pending</div>
                  <div className="text-2xl font-bold mt-1">{reportSummary.pending}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-rose-950/30 border-rose-800' : 'bg-rose-50 border-rose-200'}`}>
                  <div className="text-xs text-rose-700 dark:text-rose-300">Overdue</div>
                  <div className="text-2xl font-bold text-rose-600 mt-1">{reportSummary.overdue}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="text-xs text-slate-500">Completion Rate</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">{reportSummary.rate}%</div>
                </div>
              </div>

              {/* Category-wise Breakdown & Preview Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h3 className="text-sm font-bold mb-3">Category-wise Task Count</h3>
                  <div className="space-y-2.5">
                    {reportSummary.byCategory.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                        <span className="font-semibold">
                          {c.count} total ({c.completed} done)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`lg:col-span-2 p-5 rounded-2xl border overflow-x-auto ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h3 className="text-sm font-bold mb-3">Export Preview ({reportTasks.length} rows)</h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 pr-3">Title</th>
                        <th className="py-2 px-2">Category</th>
                        <th className="py-2 px-2">Due Date</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2">Priority</th>
                        <th className="py-2 pl-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportTasks.map((t) => {
                        const st = computeTaskStatus(t, todayIST);
                        const catName = (t.category_id && categoryMap.get(t.category_id)?.name) || '—';
                        const remCount = (remarksByTaskMap.get(t.id) || []).length;
                        return (
                          <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/60">
                            <td className="py-2 pr-3 font-medium">{t.title}</td>
                            <td className="py-2 px-2">{catName}</td>
                            <td className="py-2 px-2">{formatDateIST(t.task_date, preferences.date_format)}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                  st === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : st === 'overdue'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {st}
                              </span>
                            </td>
                            <td className="py-2 px-2">{t.priority}</td>
                            <td className="py-2 pl-2">{remCount} item(s)</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 11. SETTINGS & PROFILE SECTION                                  */}
          {/* =============================================================== */}
          {activeSection === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Admin Profile & Custom Dashboard Heading */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" /> Administrator Profile &amp; Workspace Preferences
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/60">
                    <div className="text-slate-500">Admin Username</div>
                    <div className="font-bold text-sm mt-0.5">{adminCreds.username}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/60">
                    <div className="text-slate-500">Timezone (Enforced)</div>
                    <div className="font-bold text-sm mt-0.5">Asia/Kolkata (IST)</div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Custom Dashboard Heading (Optional)
                  </label>
                  <input
                    type="text"
                    value={preferences.custom_dashboard_heading}
                    onChange={(e) =>
                      setPreferences((p) => ({ ...p, custom_dashboard_heading: e.target.value }))
                    }
                    placeholder="e.g., Vikram's Executive Command Center"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    When set, this replaces the default "Dashboard" heading at the top of the main view.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Theme Mode</label>
                    <select
                      value={preferences.theme}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, theme: e.target.value as 'light' | 'dark' }))
                      }
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Default Task View</label>
                    <select
                      value={preferences.default_task_view}
                      onChange={(e) => {
                        const mode = e.target.value as 'grid' | 'list';
                        setPreferences((p) => ({ ...p, default_task_view: mode }));
                        setViewMode(mode);
                      }}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <option value="grid">Responsive Grid</option>
                      <option value="list">Compact List</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Date Display Format</label>
                    <select
                      value={preferences.date_format}
                      onChange={(e) =>
                        setPreferences((p) => ({
                          ...p,
                          date_format: e.target.value as UserPreferences['date_format'],
                        }))
                      }
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <option value="DD MMM YYYY">31 Oct 2026</option>
                      <option value="YYYY-MM-DD">2026-10-31</option>
                      <option value="MMM DD, YYYY">Oct 31, 2026</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Change Admin Password */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" /> Change Administrator Password
                </h2>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (currentPassInput !== adminCreds.passwordHash) {
                      triggerToast('Current password is incorrect.', 'error');
                      return;
                    }
                    if (newPassInput.length < 6) {
                      triggerToast('New password must be at least 6 characters.', 'error');
                      return;
                    }
                    if (newPassInput !== confirmPassInput) {
                      triggerToast('New password and confirmation do not match.', 'error');
                      return;
                    }
                    setAdminCreds((prev) => ({ ...prev, passwordHash: newPassInput }));
                    setCurrentPassInput('');
                    setNewPassInput('');
                    setConfirmPassInput('');
                    logActivity('Changed Password', 'auth', null, 'Administrator updated password');
                    triggerToast('Administrator password updated.', 'success');
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassInput}
                      onChange={(e) => setCurrentPassInput(e.target.value)}
                      className={`w-full px-3.5 py-2 rounded-xl border text-xs ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassInput}
                        onChange={(e) => setNewPassInput(e.target.value)}
                        className={`w-full px-3.5 py-2 rounded-xl border text-xs ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassInput}
                        onChange={(e) => setConfirmPassInput(e.target.value)}
                        className={`w-full px-3.5 py-2 rounded-xl border text-xs ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                        }`}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    Update Password
                  </button>
                </form>
              </div>

              {/* Custom Category Management */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-blue-600" /> Custom Category Management
                </h2>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = newCategoryName.trim();
                    if (!clean) return;
                    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
                      triggerToast('A category with that name already exists.', 'error');
                      return;
                    }
                    const created: Category = {
                      id: generateUUID(),
                      user_id: ADMIN_USER_ID,
                      name: clean,
                      color: newCategoryColor,
                      icon: 'Folder',
                      is_default: false,
                      sort_order: categories.length + 1,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    setCategories((prev) => [...prev, created]);
                    setNewCategoryName('');
                    logActivity('Created Category', 'category', null, `Added category "${clean}"`);
                    triggerToast(`Created category "${clean}".`, 'success');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name (e.g., Finance, Fitness)..."
                    className={`flex-1 px-3.5 py-2 rounded-xl border text-xs ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                  >
                    + Add
                  </button>
                </form>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {editingCategoryId === cat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={editingCategoryColor}
                            onChange={(e) => setEditingCategoryColor(e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className={`flex-1 px-2.5 py-1 rounded border text-xs ${
                              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = editingCategoryName.trim();
                              if (!clean) return;
                              setCategories((prev) =>
                                prev.map((c) =>
                                  c.id === cat.id
                                    ? {
                                        ...c,
                                        name: clean,
                                        color: editingCategoryColor,
                                        updated_at: new Date().toISOString(),
                                      }
                                    : c
                                )
                              );
                              setEditingCategoryId(null);
                              triggerToast(`Updated category "${clean}".`, 'success');
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryId(null)}
                            className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="font-semibold">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryName(cat.name);
                                setEditingCategoryColor(cat.color);
                              }}
                              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Edit Category"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmModal({
                                  title: `Delete Category "${cat.name}"?`,
                                  message: `Tasks assigned to "${cat.name}" will remain intact and become Uncategorized.`,
                                  confirmLabel: 'Delete Category',
                                  danger: true,
                                  onConfirm: () => {
                                    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
                                    setTasks((prev) =>
                                      prev.map((t) =>
                                        t.category_id === cat.id ? { ...t, category_id: null } : t
                                      )
                                    );
                                    setConfirmModal(null);
                                    triggerToast(`Deleted category "${cat.name}".`, 'info');
                                  },
                                })
                              }
                              className="p-1.5 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Push Notification Settings & Backup/Supabase Options */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" /> Notification Preferences &amp; Data Backup
                </h2>

                <div className="space-y-2.5 text-xs">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 cursor-pointer">
                    <span className="font-semibold">Enable Notification System</span>
                    <input
                      type="checkbox"
                      checked={preferences.notifications_enabled}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, notifications_enabled: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer">
                    <span>Upcoming Task Reminders (24h prior)</span>
                    <input
                      type="checkbox"
                      checked={preferences.notify_upcoming}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, notify_upcoming: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer">
                    <span>Due Date Reminders (Morning of Due Date)</span>
                    <input
                      type="checkbox"
                      checked={preferences.notify_due_today}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, notify_due_today: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer">
                    <span>Overdue Task Alerts</span>
                    <input
                      type="checkbox"
                      checked={preferences.notify_overdue}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, notify_overdue: e.target.checked }))
                      }
                    />
                  </label>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Browser Web Push Permission:</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-semibold uppercase text-[10px]">
                      {browserPushPermission}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Background push notifications when the tab is closed use the PWA Service Worker (<code className="font-mono">/sw.js</code>), Push API, and the Supabase <code className="font-mono">push-scheduler</code> Edge Function. Note: iOS Safari requires adding the PWA to the Home Screen first.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        if (typeof Notification === 'undefined') {
                          triggerToast('Browser Notification API is blocked in this iframe.', 'info');
                          return;
                        }
                        try {
                          const perm = await Notification.requestPermission();
                          setBrowserPushPermission(perm);
                          triggerToast(`Notification permission status: ${perm}`, 'info');
                        } catch {
                          triggerToast('Permission prompt blocked by sandboxed iframe.', 'info');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Request Push Permission
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const testNotif: AppNotification = {
                          id: generateUUID(),
                          user_id: ADMIN_USER_ID,
                          task_id: tasks[0]?.id || null,
                          type: 'system',
                          title: 'Test Push Dispatch Verified',
                          message: `Push pipeline check completed at ${formatDateTimeIST(new Date().toISOString())}`,
                          is_read: false,
                          scheduled_for: new Date().toISOString(),
                          created_at: new Date().toISOString(),
                          dedupe_key: `test:${Date.now()}`,
                        };
                        setNotifications((prev) => [testNotif, ...prev]);
                        triggerToast('Dispatched test alert to Notification Center.', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                    >
                      Send Test Alert
                    </button>
                  </div>
                </div>

                {/* Data Backup & Supabase Connection */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Full JSON Backup
                  </button>

                  <label className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Restore JSON Backup
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackupFile}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowSupabaseModal(true)}
                    className="px-3.5 py-2 rounded-xl border border-blue-500/40 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5" /> Configure Supabase &amp; View SQL
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-30 border-t px-2 py-1.5 flex items-center justify-around ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {[
          { id: 'dashboard' as NavSection, label: 'Home', icon: LayoutDashboard },
          { id: 'today' as NavSection, label: 'Today', icon: Clock },
          { id: 'all' as NavSection, label: 'Tasks', icon: CheckSquare },
          { id: 'calendar' as NavSection, label: 'Calendar', icon: CalendarIcon },
          { id: 'reports' as NavSection, label: 'Reports', icon: FileSpreadsheet },
          { id: 'settings' as NavSection, label: 'Settings', icon: SettingsIcon },
        ].map((m) => {
          const Icon = m.icon;
          const active = activeSection === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveSection(m.id)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold ${
                active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </nav>

      {/* =================================================================== */}
      {/* CREATE / EDIT TASK MODAL (WITH VOICE NOTE RECORDER & RECURRENCE)    */}
      {/* =================================================================== */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-2xl border p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-bold">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h2>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
              {/* 1. Task Title (Mandatory) */}
              <div>
                <label className="block font-semibold mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enter a clear, actionable task title..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                  }`}
                  required
                />
              </div>

              {/* 2. Description (Optional) */}
              <div>
                <label className="block font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Add context, links, or deliverables..."
                  className={`w-full px-3.5 py-2 rounded-xl border ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              {/* 3. Category, 4. Task Date (Mandatory, no time), 6. Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Task Date (IST) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as Priority)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* 7. Pin Task & Recurrence Toggle */}
              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                  />
                  <Pin className="w-3.5 h-3.5 text-amber-500" /> Pin as Important Task
                </label>

                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnableRecurrence}
                    onChange={(e) => setFormEnableRecurrence(e.target.checked)}
                  />
                  <Repeat className="w-3.5 h-3.5 text-purple-500" /> Repeat / Recurring Task
                </label>
              </div>

              {/* 14. Recurring Task Options */}
              {formEnableRecurrence && (
                <div className={`p-3.5 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-purple-50/60 border-purple-200'}`}>
                  <div className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" /> Automated Recurrence Configuration
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase mb-1">Frequency</label>
                      <select
                        value={formRecFrequency}
                        onChange={(e) => setFormRecFrequency(e.target.value as RecurrenceFrequency)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase mb-1">Repeat Interval</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={formRecInterval}
                        onChange={(e) => setFormRecInterval(Number(e.target.value))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                      />
                    </div>

                    {formRecFrequency === 'custom' && (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase mb-1">Custom Unit</label>
                        <select
                          value={formRecCustomUnit}
                          onChange={(e) => setFormRecCustomUnit(e.target.value as 'days' | 'weeks' | 'months')}
                          className={`w-full px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                        >
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                    )}

                    {formRecFrequency === 'monthly' && (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase mb-1">Day of Month (1-31)</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={formRecMonthDay}
                          onChange={(e) => setFormRecMonthDay(Number(e.target.value))}
                          className={`w-full px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                    )}
                  </div>

                  {formRecFrequency === 'weekly' && (
                    <div>
                      <label className="block text-[10px] font-semibold uppercase mb-1">Weekdays</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dName, idx) => {
                          const selected = formRecWeekdays.includes(idx);
                          return (
                            <button
                              key={dName}
                              type="button"
                              onClick={() =>
                                setFormRecWeekdays((prev) =>
                                  prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                selected
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : isDark
                                  ? 'bg-slate-900 border-slate-700'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {dName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase mb-1">Start Date</label>
                      <input
                        type="date"
                        value={formRecStartDate}
                        onChange={(e) => setFormRecStartDate(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase mb-1">End Date (Optional)</label>
                      <input
                        type="date"
                        value={formRecEndDate}
                        onChange={(e) => setFormRecEndDate(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Voice Note Recorder Section */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-blue-600" /> Voice Note Recording (Optional)
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:
                    {String(recordingDuration % 60).padStart(2, '0')}
                  </span>
                </div>

                {micError && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px]">
                    {micError}
                  </div>
                )}

                {recordingStatus === 'idle' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5"
                    >
                      <Mic className="w-3.5 h-3.5" /> Record Microphone Audio
                    </button>
                    <button
                      type="button"
                      onClick={generateSampleVoiceNote}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1.5"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Attach Sample Audio Note
                    </button>
                  </div>
                )}

                {(recordingStatus === 'recording' || recordingStatus === 'paused') && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                      {recordingStatus === 'recording' ? 'Recording...' : 'Paused'}
                    </span>
                    <button
                      type="button"
                      onClick={pauseOrResumeRecording}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1"
                    >
                      {recordingStatus === 'recording' ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Resume
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold flex items-center gap-1"
                    >
                      <Square className="w-3.5 h-3.5" /> Stop &amp; Preview
                    </button>
                  </div>
                )}

                {recordingStatus === 'recorded' && recordedAudioUrl && (
                  <div className="space-y-2">
                    <audio controls src={recordedAudioUrl} className="w-full h-9" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Ready to upload to private <code className="font-mono">voice-notes</code> bucket ({Math.round(recordedSizeBytes / 1024)} KB)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            deleteRecordedVoice();
                            startVoiceRecording();
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Record Again
                        </button>
                        <button
                          type="button"
                          onClick={deleteRecordedVoice}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete Audio
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TASK DETAILS & CHRONOLOGICAL REMARKS DRAWER                         */}
      {/* =================================================================== */}
      {selectedTask && (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className={`w-full max-w-xl h-full overflow-y-auto p-6 border-l flex flex-col justify-between ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="space-y-5">
              {/* Top Drawer Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Task Details &amp; Remarks
                  </span>
                  {selectedTask.is_pinned && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Quick Actions */}
              <div>
                <h2 className="text-lg font-bold leading-snug mb-2">{selectedTask.title}</h2>
                {selectedTask.description ? (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                    {selectedTask.description}
                  </p>
                ) : (
                  <p className="text-xs italic text-slate-400">No description provided.</p>
                )}
              </div>

              {/* Metadata Grid */}
              <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl border text-xs ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Current Status</div>
                  <div className="font-bold mt-0.5 capitalize">{computeTaskStatus(selectedTask, todayIST)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Due Date (IST)</div>
                  <div className="font-bold mt-0.5">{formatDateIST(selectedTask.task_date, preferences.date_format)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Priority</div>
                  <div className="font-bold mt-0.5">{selectedTask.priority}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Category</div>
                  <div className="font-bold mt-0.5">
                    {(selectedTask.category_id && categoryMap.get(selectedTask.category_id)?.name) || 'Uncategorized'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Created At</div>
                  <div className="font-medium mt-0.5">{formatDateTimeIST(selectedTask.created_at)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Completed At</div>
                  <div className="font-medium mt-0.5">
                    {selectedTask.completed_at ? formatDateTimeIST(selectedTask.completed_at) : '—'}
                  </div>
                </div>
              </div>

              {/* Recurrence Controls if Recurring */}
              {selectedTask.recurrence_id && recurrenceMap.get(selectedTask.recurrence_id) && (
                <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${isDark ? 'bg-purple-950/30 border-purple-800' : 'bg-purple-50 border-purple-200'}`}>
                  {(() => {
                    const rec = recurrenceMap.get(selectedTask.recurrence_id!)!;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                            <Repeat className="w-3.5 h-3.5" /> Recurring Schedule ({rec.frequency}, every {rec.interval_value})
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-600 text-white">
                            {rec.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {rec.status !== 'active' && (
                            <button
                              type="button"
                              onClick={() => updateRecurrenceStatus(rec.id, 'active')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold"
                            >
                              Resume Recurrence
                            </button>
                          )}
                          {rec.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => updateRecurrenceStatus(rec.id, 'paused')}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold"
                            >
                              Pause Recurrence
                            </button>
                          )}
                          {rec.status !== 'stopped' && (
                            <button
                              type="button"
                              onClick={() => updateRecurrenceStatus(rec.id, 'stopped')}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold"
                            >
                              Stop Recurrence
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Voice Note Player inside Task Details */}
              {attachmentByTaskMap.get(selectedTask.id) && (
                <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50/60 border-blue-200'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <Volume2 className="w-4 h-4" /> Recorded Voice Note ({attachmentByTaskMap.get(selectedTask.id)!.duration_seconds}s)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          title: 'Delete Voice Note?',
                          message: 'Remove the voice recording attached to this task?',
                          confirmLabel: 'Delete Voice Note',
                          danger: true,
                          onConfirm: () => {
                            setAttachments((prev) => prev.filter((a) => a.task_id !== selectedTask.id));
                            setConfirmModal(null);
                            triggerToast('Voice note removed from task.', 'info');
                          },
                        })
                      }
                      className="text-rose-600 hover:underline text-xs font-semibold"
                    >
                      Remove Audio
                    </button>
                  </div>
                  <audio
                    controls
                    src={attachmentByTaskMap.get(selectedTask.id)!.audio_data_url}
                    className="w-full h-9"
                  />
                </div>
              )}

              {/* Chronological Remarks History */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Chronological Remarks History ({(remarksByTaskMap.get(selectedTask.id) || []).length})
                </h3>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {(remarksByTaskMap.get(selectedTask.id) || []).length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-3">
                      No remarks recorded yet. Add progress updates below.
                    </div>
                  ) : (
                    (remarksByTaskMap.get(selectedTask.id) || []).map((rem, idx) => (
                      <div
                        key={rem.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                          isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            #{idx + 1} • {formatDateTimeIST(rem.created_at)}
                            {rem.is_edited && ' (edited)'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRemarkId(rem.id);
                                setEditingRemarkContent(rem.content);
                              }}
                              className="hover:text-slate-700 dark:hover:text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRemark(rem)}
                              className="text-rose-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {editingRemarkId === rem.id ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editingRemarkContent}
                              onChange={(e) => setEditingRemarkContent(e.target.value)}
                              className={`w-full p-2 rounded-lg border text-xs ${
                                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                              }`}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEditedRemark(rem)}
                                className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold"
                              >
                                Save Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRemarkId(null)}
                                className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line">
                            {rem.content}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add New Remark Input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newRemarkText}
                    onChange={(e) => setNewRemarkText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRemark(selectedTask.id);
                      }
                    }}
                    placeholder="Add a timestamped remark (never overwrites history)..."
                    className={`flex-1 px-3.5 py-2 rounded-xl border text-xs ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddRemark(selectedTask.id)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                  >
                    Add Remark
                  </button>
                </div>
              </div>

              {/* Completion History Audit Trail */}
              {selectedTask.completion_history && selectedTask.completion_history.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> Completion Audit History
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500">
                    {selectedTask.completion_history.map((h, i) => (
                      <div key={i}>
                        • Completed {formatDateTimeIST(h.completed_at)}
                        {h.reopened_at ? ` → Reopened ${formatDateTimeIST(h.reopened_at)}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar in Drawer */}
            <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleCompleteTask(selectedTask)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                  selectedTask.status === 'completed'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {selectedTask.status === 'completed' ? 'Reopen Task' : 'Mark Completed'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditTaskModal(selectedTask)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                {!selectedTask.is_trashed ? (
                  <button
                    type="button"
                    onClick={() => requestMoveToTrash(selectedTask)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Trash
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestPermanentDelete(selectedTask)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Forever
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* NOTIFICATIONS DRAWER                                                */}
      {/* =================================================================== */}
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className={`w-full max-w-md h-full p-6 border-l flex flex-col justify-between ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" /> Notifications &amp; Reminders
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{unreadNotificationsCount} unread notifications</span>
                <button
                  type="button"
                  onClick={() =>
                    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
                  }
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Mark All as Read
                </button>
              </div>

              <div className="space-y-2.5">
                {notifications.length === 0 ? (
                  <div className="text-xs text-slate-500 py-8 text-center">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
                        );
                        if (n.task_id) {
                          setSelectedTaskId(n.task_id);
                          setShowNotificationsDrawer(false);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                        !n.is_read
                          ? isDark
                            ? 'bg-blue-950/30 border-blue-800'
                            : 'bg-blue-50/70 border-blue-200'
                          : isDark
                          ? 'bg-slate-800/40 border-slate-800 opacity-75'
                          : 'bg-slate-50 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="font-bold mb-0.5">{n.title}</div>
                      <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {formatDateTimeIST(n.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CLOUD SYNC MODAL (FREE FIREBASE 1-LINK SYNC + SUPABASE POSTGRESQL)  */}
      {/* =================================================================== */}
      {showSupabaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" /> Free Cloud Sync (Firebase 1-Click Alternative or Supabase)
              </h2>
              <button
                type="button"
                onClick={() => setShowSupabaseModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option A: 100% Free Google Firebase Realtime Database (Zero Coding, No Credit Card) */}
            <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? 'bg-emerald-950/25 border-emerald-800/70' : 'bg-emerald-50/70 border-emerald-200'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Recommended Free Alternative: Google Firebase (No Credit Card, Zero Coding)
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  100% FREE SPARK PLAN
                </span>
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <li>Open <strong>console.firebase.google.com</strong> with your Gmail account and click <strong>Create a project</strong>.</li>
                <li>In the left menu, click <strong>Build → Realtime Database → Create Database</strong> and pick <strong>Start in test mode</strong>.</li>
                <li>Copy the single link shown at the top (ending in <code className="font-mono">.firebaseio.com</code> or <code className="font-mono">.firebasedatabase.app</code>) and paste it below:</li>
              </ol>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={supabaseConfig.firebaseUrl || ''}
                  onChange={(e) =>
                    setSupabaseConfig((prev) => ({
                      ...prev,
                      provider: 'firebase',
                      firebaseUrl: e.target.value,
                    }))
                  }
                  placeholder="https://your-project-default-rtdb.firebaseio.com"
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs ${
                    isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={() => pushStateToFirebase(supabaseConfig.firebaseUrl, false)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                >
                  {isSyncingCloud ? 'Syncing...' : 'Connect & Save to Firebase'}
                </button>
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={() => pullStateFromFirebase(supabaseConfig.firebaseUrl)}
                  className="px-3.5 py-2 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shrink-0"
                >
                  Load from Firebase
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Connect your live Supabase project below using your Project URL and public <code className="font-mono">anon</code> key (never enter a <code className="font-mono">service_role</code> key in the browser). When no live credentials are provided, ApexTask persists all relational tables safely in local browser storage and never fabricates remote database connections.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Supabase Project URL</label>
                <input
                  type="url"
                  value={supabaseConfig.url}
                  onChange={(e) =>
                    setSupabaseConfig((prev) => ({ ...prev, url: e.target.value, connected: false }))
                  }
                  placeholder="https://xyzcompany.supabase.co"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Supabase Public Anon Key</label>
                <input
                  type="password"
                  value={supabaseConfig.anonKey}
                  onChange={(e) =>
                    setSupabaseConfig((prev) => ({ ...prev, anonKey: e.target.value, connected: false }))
                  }
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const cleanUrl = supabaseConfig.url.trim().replace(/\/$/, '');
                  const cleanKey = supabaseConfig.anonKey.trim();
                  if (!cleanUrl || !cleanKey) {
                    triggerToast('Enter both Supabase Project URL and Anon Key first.', 'error');
                    return;
                  }
                  try {
                    const testEndpoint = new URL('/rest/v1/categories?select=id&limit=1', cleanUrl).toString();
                    const res = await fetch(testEndpoint, {
                      headers: { apikey: cleanKey, Authorization: `Bearer ${cleanKey}` },
                    });
                    if (res.ok) {
                      setSupabaseConfig({
                        url: cleanUrl,
                        anonKey: cleanKey,
                        connected: true,
                        lastVerifiedAt: new Date().toISOString(),
                      });
                      triggerToast('Verified live Supabase PostgreSQL connection!', 'success');
                    } else {
                      triggerToast(`Supabase returned HTTP ${res.status}. Verify schema migration & keys.`, 'error');
                    }
                  } catch {
                    triggerToast('Could not reach Supabase URL (check network or CORS).', 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Verify &amp; Connect Live Supabase
              </button>

              {supabaseConfig.connected && (
                <button
                  type="button"
                  onClick={() => {
                    setSupabaseConfig({ url: '', anonKey: '', connected: false, lastVerifiedAt: null });
                    triggerToast('Switched to Local Persistent Storage mode.', 'info');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Disconnect
                </button>
              )}
            </div>

            <div className={`p-4 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="font-bold text-blue-600 dark:text-blue-400">
                Included Relational Tables &amp; RLS Architecture (See Project ZIP):
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <li>10 UUID-keyed tables: <code className="font-mono">profiles, tasks, categories, task_remarks, task_attachments, task_recurrences, notifications, activity_logs, user_preferences, push_subscriptions</code></li>
                <li>Row Level Security (<code className="font-mono">public.is_authenticated_admin</code>) restricting all CRUD to the single administrator</li>
                <li>Idempotent PostgreSQL function <code className="font-mono">public.generate_next_recurring_occurrence</code> preventing duplicate recurring tasks</li>
                <li>Private <code className="font-mono">voice-notes</code> Storage bucket policies + <code className="font-mono">scripts/setup-admin.mjs</code> server-side provisioning script</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONFIRMATION MODAL (REPLACES WINDOW.CONFIRM FOR ALL DELETIONS)      */}
      {/* =================================================================== */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-xl space-y-4 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className="text-base font-bold">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold ${
                  confirmModal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
