import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, CheckSquare, Calendar as CalendarIcon, Pin, Clock, AlertCircle,
  Trash2, Plus, Search, Mic, Square, Check, LogOut, Volume2, Sun, Moon, DownloadCloud,
  Sparkles, Star, User, Users, Play, Pause, Edit3, X
} from 'lucide-react';

const FIREBASE_URL = 'https://mytasks-52442-default-rtdb.firebaseio.com';

const getCategoryName = (cat: any): string => {
  if (!cat) return 'General';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object' && cat.name) return String(cat.name);
  return 'General';
};

// Calculate overdue days between task_date and todayIST
const getOverdueDays = (taskDate: string, todayIST: string): number => {
  if (!taskDate || taskDate >= todayIST) return 0;
  const [y1, m1, d1] = taskDate.split('-').map(Number);
  const [y2, m2, d2] = todayIST.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Consistent, high-contrast color palette for each team member (Assignee)
const ASSIGNEE_PALETTES = [
  {
    light: 'bg-blue-100 text-blue-900 border-blue-300',
    dark: 'bg-blue-950/90 text-blue-100 border-blue-700',
    dot: 'bg-blue-600'
  },
  {
    light: 'bg-purple-100 text-purple-900 border-purple-300',
    dark: 'bg-purple-950/90 text-purple-100 border-purple-700',
    dot: 'bg-purple-600'
  },
  {
    light: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dark: 'bg-emerald-950/90 text-emerald-100 border-emerald-700',
    dot: 'bg-emerald-600'
  },
  {
    light: 'bg-amber-100 text-amber-900 border-amber-300',
    dark: 'bg-amber-950/90 text-amber-100 border-amber-700',
    dot: 'bg-amber-600'
  },
  {
    light: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    dark: 'bg-fuchsia-950/90 text-fuchsia-100 border-fuchsia-700',
    dot: 'bg-fuchsia-600'
  },
  {
    light: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    dark: 'bg-cyan-950/90 text-cyan-100 border-cyan-700',
    dot: 'bg-cyan-600'
  },
  {
    light: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    dark: 'bg-indigo-950/90 text-indigo-100 border-indigo-700',
    dot: 'bg-indigo-600'
  },
  {
    light: 'bg-teal-100 text-teal-900 border-teal-300',
    dark: 'bg-teal-950/90 text-teal-100 border-teal-700',
    dot: 'bg-teal-600'
  }
];

const getAssigneeColor = (name: string, darkMode: boolean) => {
  const clean = (name || '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ASSIGNEE_PALETTES.length;
  const palette = ASSIGNEE_PALETTES[index];
  return {
    badgeClass: darkMode ? palette.dark : palette.light,
    dotClass: palette.dot
  };
};

// Play a pleasant success chime using the Web Audio API
const playCompletionSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

interface TaskRemark {
  id: string;
  text: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  category: any;
  task_date: string;
  status: 'pending' | 'completed';
  priority: 'High' | 'Medium' | 'Low';
  is_pinned: boolean;
  is_deleted: boolean;
  completed_at?: string;
  audio_url?: string;
  assigned_to?: string;
  remarks: TaskRemark[];
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  created_at: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('apex_tasks');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apex_categories');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(getCategoryName);
      }
      return ['Work', 'Personal', 'Content Creation', 'Business', 'Meetings', 'Other'];
    } catch {
      return ['Work', 'Personal', 'Content Creation', 'Business', 'Meetings', 'Other'];
    }
  });

  const [assignees, setAssignees] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apex_assignees');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String);
      }
      return ['Me'];
    } catch {
      return ['Me'];
    }
  });

  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('All');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex_theme') === 'dark';
    } catch {
      return false;
    }
  });

  // Modals & Edit States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [inlineNewAssignee, setInlineNewAssignee] = useState('');
  const [showInlineAddAssignee, setShowInlineAddAssignee] = useState(false);

  // Task Form State (used for both Create and Edit)
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState('Work');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [taskPriority, setTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [taskPinned, setTaskPinned] = useState(false);
  const [taskAssignedTo, setTaskAssignedTo] = useState<string>('');
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Direct Card Audio Player State
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const cardAudioRef = useRef<HTMLAudioElement | null>(null);

  const [syncStatus, setSyncStatus] = useState<string>('Ready');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const todayIST = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }, []);

  // Listen for PWA desktop install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      alert('To install on Desktop: Click the Install icon in your browser URL bar or menu.');
    }
  };

  // Keyboard shortcut: Press "N" to add task, "Escape" to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        setIsCreateOpen(false);
        setEditingTaskId(null);
        setSelectedTask(null);
        setIsManageTeamOpen(false);
        return;
      }

      if ((e.key === 'n' || e.key === 'N') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isAuthenticated) {
          e.preventDefault();
          openCreateModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, todayIST]);

  useEffect(() => {
    try {
      localStorage.setItem('apex_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error(e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('apex_categories', JSON.stringify(categories));
    } catch (e) {
      console.error(e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem('apex_assignees', JSON.stringify(assignees));
    } catch (e) {
      console.error(e);
    }
  }, [assignees]);

  useEffect(() => {
    try {
      localStorage.setItem('apex_theme', darkMode ? 'dark' : 'light');
    } catch (e) {
      console.error(e);
    }
  }, [darkMode]);

  // Safe Firebase Fetch on Mount (Preserves all existing data)
  useEffect(() => {
    const fetchFromFirebase = async () => {
      try {
        setSyncStatus('Connecting Cloud...');
        const res = await fetch(`${FIREBASE_URL}/apextask_workspace.json`);
        if (!res.ok) throw new Error('Cloud fetch failed');
        const data = await res.json();
        if (data) {
          if (Array.isArray(data.tasks)) {
            setTasks(data.tasks);
          } else if (data.tasks && typeof data.tasks === 'object') {
            setTasks(Object.values(data.tasks));
          }
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(data.categories.map(getCategoryName));
          }
          if (Array.isArray(data.assignees) && data.assignees.length > 0) {
            setAssignees(data.assignees.map(String));
          }
          setSyncStatus('Synced');
        } else {
          setSyncStatus('Cloud Live');
        }
      } catch (err) {
        console.error('Firebase initial load error:', err);
        setSyncStatus('Local Mode');
      }
    };
    fetchFromFirebase();
  }, []);

  const saveToFirebase = async (
    updatedTasks: Task[],
    updatedCategories: string[],
    updatedAssignees: string[] = assignees
  ) => {
    try {
      setSyncStatus('Saving...');
      await fetch(`${FIREBASE_URL}/apextask_workspace.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: updatedTasks,
          categories: updatedCategories,
          assignees: updatedAssignees,
          last_updated: new Date().toISOString()
        })
      });
      setSyncStatus('Synced');
    } catch (err) {
      console.error('Firebase save error:', err);
      setSyncStatus('Saved Locally');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password === 'Admin@2026') {
      setIsAuthenticated(true);
      try {
        localStorage.setItem('apex_auth', 'true');
      } catch (e) {}
      setAuthError('');
    } else {
      setAuthError('Invalid Credentials. Use: admin / Admin@2026');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('apex_auth');
    } catch (e) {}
  };

  // Play / Stop Voice Note directly from the Task Card
  const toggleCardAudio = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!task.audio_url) return;

    if (playingTaskId === task.id) {
      if (cardAudioRef.current) {
        cardAudioRef.current.pause();
        cardAudioRef.current.currentTime = 0;
      }
      setPlayingTaskId(null);
      return;
    }

    if (cardAudioRef.current) {
      cardAudioRef.current.pause();
    }

    const audio = new Audio(task.audio_url);
    cardAudioRef.current = audio;
    setPlayingTaskId(task.id);

    audio.onended = () => {
      setPlayingTaskId(null);
    };
    audio.onerror = () => {
      setPlayingTaskId(null);
    };
    audio.play().catch(() => {
      setPlayingTaskId(null);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setRecordedAudio(reader.result as string);
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      alert('Microphone permission denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const openCreateModal = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskCategory(categories[0] || 'Work');
    setTaskDate(todayIST);
    setTaskPriority('Medium');
    setTaskPinned(false);
    setTaskAssignedTo('');
    setRecordedAudio(null);
    setShowInlineAddAssignee(false);
    setInlineNewAssignee('');
    setIsCreateOpen(true);
  };

  const openEditModal = (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTaskId(task.id);
    setTaskTitle(task.title || '');
    setTaskDesc(task.description || '');
    setTaskCategory(getCategoryName(task.category) || 'Work');
    setTaskDate(task.task_date || todayIST);
    setTaskPriority(task.priority || 'Medium');
    setTaskPinned(Boolean(task.is_pinned));
    setTaskAssignedTo(task.assigned_to || '');
    setRecordedAudio(task.audio_url || null);
    setShowInlineAddAssignee(false);
    setInlineNewAssignee('');
    setSelectedTask(null);
    setIsCreateOpen(true);
  };

  // Add a new person to Assignees list
  const handleAddAssigneePerson = (nameToAdd: string, selectImmediately = false) => {
    const clean = nameToAdd.trim();
    if (!clean) return;
    const exists = assignees.some((a) => a.toLowerCase() === clean.toLowerCase());
    const nextAssignees = exists ? assignees : [...assignees, clean];
    setAssignees(nextAssignees);
    if (selectImmediately) {
      setTaskAssignedTo(clean);
    }
    saveToFirebase(tasks, categories, nextAssignees);
  };

  const handleRemoveAssigneePerson = (nameToRemove: string) => {
    const nextAssignees = assignees.filter((a) => a !== nameToRemove);
    setAssignees(nextAssignees);
    saveToFirebase(tasks, categories, nextAssignees);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    let finalAssignedTo = taskAssignedTo.trim();
    let updatedAssigneesList = assignees;
    if (showInlineAddAssignee && inlineNewAssignee.trim()) {
      finalAssignedTo = inlineNewAssignee.trim();
      const exists = assignees.some((a) => a.toLowerCase() === finalAssignedTo.toLowerCase());
      if (!exists) {
        updatedAssigneesList = [...assignees, finalAssignedTo];
        setAssignees(updatedAssigneesList);
      }
    }

    if (editingTaskId) {
      const nextTasks = tasks.map((t) => {
        if (t.id === editingTaskId) {
          return {
            ...t,
            title: taskTitle.trim(),
            description: taskDesc.trim() || undefined,
            category: getCategoryName(taskCategory) || 'Work',
            task_date: taskDate || todayIST,
            priority: taskPriority,
            is_pinned: taskPinned,
            assigned_to: finalAssignedTo || undefined,
            audio_url: recordedAudio || undefined
          };
        }
        return t;
      });
      setTasks(nextTasks);
      saveToFirebase(nextTasks, categories, updatedAssigneesList);
    } else {
      const newTask: Task = {
        id: 'task_' + Date.now(),
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        category: getCategoryName(taskCategory) || 'Work',
        task_date: taskDate || todayIST,
        status: 'pending',
        priority: taskPriority,
        is_pinned: taskPinned,
        is_deleted: false,
        assigned_to: finalAssignedTo || undefined,
        audio_url: recordedAudio || undefined,
        remarks: [],
        recurrence: 'none',
        created_at: new Date().toISOString()
      };

      const nextTasks = [newTask, ...tasks];
      setTasks(nextTasks);
      saveToFirebase(nextTasks, categories, updatedAssigneesList);
    }

    setTaskTitle('');
    setTaskDesc('');
    setRecordedAudio(null);
    setTaskPinned(false);
    setTaskAssignedTo('');
    setEditingTaskId(null);
    setIsCreateOpen(false);
  };

  // Complete task with sound effect and smooth exit from dashboard
  const toggleComplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const willBeCompleted = task?.status !== 'completed';

    if (willBeCompleted) {
      playCompletionSound();
      setRecentlyCompletedId(taskId);
      setTimeout(() => setRecentlyCompletedId(null), 600);
    }

    const nextTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: willBeCompleted ? 'completed' : 'pending',
          completed_at: willBeCompleted ? new Date().toISOString() : undefined
        } as Task;
      }
      return t;
    });

    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories, assignees);
  };

  const handleAddRemark = (taskId: string) => {
    if (!newRemarkText.trim()) return;
    const newRemark: TaskRemark = {
      id: 'rem_' + Date.now(),
      text: newRemarkText.trim(),
      created_at: new Date().toISOString()
    };

    const nextTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, remarks: [...(t.remarks || []), newRemark] };
      }
      return t;
    });

    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories, assignees);
    setNewRemarkText('');

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, remarks: [...(prev.remarks || []), newRemark] } : null));
    }
  };

  const moveToTrash = (taskId: string) => {
    const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, is_deleted: true } : t));
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories, assignees);
    setSelectedTask(null);
  };

  const restoreFromTrash = (taskId: string) => {
    const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, is_deleted: false } : t));
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories, assignees);
  };

  const permanentlyDelete = (taskId: string) => {
    if (!confirm('Permanently delete this task?')) return;
    const nextTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories, assignees);
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const activeTasks = useMemo(() => safeTasks.filter((t) => !t.is_deleted), [safeTasks]);
  const trashedTasks = useMemo(() => safeTasks.filter((t) => t.is_deleted), [safeTasks]);

  // Collect all unique assignee names from both saved list and existing tasks
  const allAssigneeOptions = useMemo(() => {
    const set = new Set<string>(assignees);
    activeTasks.forEach((t) => {
      if (t.assigned_to && t.assigned_to.trim()) {
        set.add(t.assigned_to.trim());
      }
    });
    return Array.from(set);
  }, [assignees, activeTasks]);

  // Dynamic Task Filtering & Automatic Sorting
  const filteredTasks = useMemo(() => {
    let list = activeTasks;

    if (activeSection === 'dashboard') {
      // Dashboard shows ONLY Today's Pending Tasks + Past Pending/Overdue Tasks (Excludes completed tasks)
      list = list.filter((t) => (t.status === 'pending' && t.task_date <= todayIST) || t.id === recentlyCompletedId);
    } else if (activeSection === 'today') {
      list = list.filter((t) => t.task_date === todayIST);
    } else if (activeSection === 'upcoming') {
      list = list.filter((t) => t.task_date > todayIST);
    } else if (activeSection === 'pinned') {
      list = list.filter((t) => t.is_pinned);
    } else if (activeSection === 'completed') {
      list = list.filter((t) => t.status === 'completed');
    } else if (activeSection === 'overdue') {
      list = list.filter((t) => t.status === 'pending' && t.task_date < todayIST);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.assigned_to && t.assigned_to.toLowerCase().includes(q)) ||
          (t.remarks && t.remarks.some((r) => r.text && r.text.toLowerCase().includes(q)))
      );
    }

    if (selectedCategory !== 'All') {
      list = list.filter((t) => getCategoryName(t.category) === selectedCategory);
    }

    if (selectedPriority !== 'All') {
      list = list.filter((t) => t.priority === selectedPriority);
    }

    if (selectedAssigneeFilter !== 'All') {
      list = list.filter((t) => (t.assigned_to || '') === selectedAssigneeFilter);
    }

    return [...list].sort((a, b) => {
      // 1. Incomplete tasks always come before Completed tasks
      const aDone = a.status === 'completed' ? 1 : 0;
      const bDone = b.status === 'completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      if (aDone === 0) {
        const aOverdueDays = getOverdueDays(a.task_date, todayIST);
        const bOverdueDays = getOverdueDays(b.task_date, todayIST);

        // 2. Overdue tasks always come before non-overdue tasks
        const aIsOverdue = aOverdueDays > 0 ? 1 : 0;
        const bIsOverdue = bOverdueDays > 0 ? 1 : 0;
        if (aIsOverdue !== bIsOverdue) return bIsOverdue - aIsOverdue;

        // 3. Among overdue tasks: MOST OVERDUE (highest overdue days / oldest date / 5 stars) comes FIRST!
        if (aIsOverdue && bIsOverdue && aOverdueDays !== bOverdueDays) {
          return bOverdueDays - aOverdueDays;
        }
      }

      // 4. Default fallback: sort by date
      return a.task_date.localeCompare(b.task_date);
    });
  }, [
    activeTasks,
    activeSection,
    todayIST,
    searchQuery,
    selectedCategory,
    selectedPriority,
    selectedAssigneeFilter,
    recentlyCompletedId
  ]);

  const stats = useMemo(() => {
    const total = activeTasks.length;
    const today = activeTasks.filter((t) => t.task_date === todayIST).length;
    const pending = activeTasks.filter((t) => t.status === 'pending').length;
    const completed = activeTasks.filter((t) => t.status === 'completed').length;
    const overdue = activeTasks.filter((t) => t.status === 'pending' && t.task_date < todayIST).length;
    const upcoming = activeTasks.filter((t) => t.task_date > todayIST).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, today, pending, completed, overdue, upcoming, rate };
  }, [activeTasks, todayIST]);

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl shadow-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ApexTask</h1>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Admin Login</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-600 rounded-lg text-sm font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin@2026"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <aside className={`w-full md:w-64 border-r p-5 flex flex-col justify-between shrink-0 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight">ApexTask</h2>
                <span className={`text-[11px] font-medium flex items-center gap-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {syncStatus}
                </span>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-1.5 rounded-lg border transition ${darkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-400' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={handleInstallClick}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                  : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <DownloadCloud className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Install App</span>
            </button>

            <button
              onClick={() => setIsManageTeamOpen(true)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                  : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Manage Team</span>
            </button>
          </div>

          <nav className="space-y-1 text-sm font-medium">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'all', label: 'All Tasks', icon: CheckSquare, count: stats.total },
              { id: 'today', label: "Today's Tasks", icon: Clock, count: stats.today },
              { id: 'upcoming', label: 'Upcoming Tasks', icon: CalendarIcon, count: stats.upcoming },
              { id: 'pinned', label: 'Pinned Tasks', icon: Pin },
              { id: 'completed', label: 'Completed Tasks', icon: Check, count: stats.completed },
              { id: 'overdue', label: 'Overdue Tasks', icon: AlertCircle, count: stats.overdue },
              { id: 'trash', label: 'Trash', icon: Trash2, count: trashedTasks.length }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : darkMode
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-blue-700 text-white' : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={`pt-6 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className={`mb-3 px-3 py-1.5 rounded-lg text-[11px] flex items-center justify-between ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            <span>Shortcut:</span>
            <span className={`font-mono px-1.5 py-0.5 rounded font-bold ${darkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-800 border border-slate-300'}`}>N</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold capitalize">
              {activeSection === 'dashboard' ? 'Daily Focus Dashboard' : activeSection}
            </h1>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {activeSection === 'dashboard'
                ? `Prioritizing Most Overdue Tasks First & Today's Pending Items • Asia/Kolkata (${todayIST})`
                : `Asia/Kolkata (IST) • ${todayIST}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
              <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-700 text-blue-100 rounded border border-blue-500">N</kbd>
            </button>
          </div>
        </div>

        {activeSection === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: 'Total Tasks', value: stats.total, color: darkMode ? 'text-blue-400' : 'text-blue-600' },
              { label: "Today's Focus", value: stats.today, color: darkMode ? 'text-indigo-400' : 'text-indigo-600' },
              { label: 'Pending', value: stats.pending, color: darkMode ? 'text-amber-400' : 'text-amber-600' },
              { label: 'Completed', value: stats.completed, color: darkMode ? 'text-emerald-400' : 'text-emerald-600' },
              { label: 'Overdue Pending', value: stats.overdue, color: darkMode ? 'text-rose-400' : 'text-rose-600' },
              { label: 'Completion', value: `${stats.rate}%`, color: darkMode ? 'text-emerald-400' : 'text-emerald-600' }
            ].map((stat, i) => (
              <div key={i} className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</span>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className={`w-4 h-4 absolute left-3.5 top-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="Search tasks, assignees, descriptions, remarks... (Press 'N' to Add)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="All">All Assignees</option>
              {allAssigneeOptions.map((person, idx) => (
                <option key={idx} value={person}>
                  Assigned: {person}
                </option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="All">All Categories</option>
              {categories.map((c, idx) => {
                const name = getCategoryName(c);
                return (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        {activeSection === 'trash' ? (
          <div className="space-y-3">
            {trashedTasks.length === 0 ? (
              <p className={`text-center py-12 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Trash is empty.</p>
            ) : (
              trashedTasks.map((task) => (
                <div key={task.id} className={`p-4 rounded-xl border flex items-center justify-between ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
                  <div>
                    <h3 className={`font-semibold text-sm line-through ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{task.title}</h3>
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{getCategoryName(task.category)} &bull; {task.task_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreFromTrash(task.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${darkMode ? 'bg-blue-950 text-blue-300 hover:bg-blue-900' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => permanentlyDelete(task.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${darkMode ? 'bg-red-950 text-red-300 hover:bg-red-900' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.length === 0 ? (
              <div className={`col-span-full text-center py-16 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50 text-blue-500" />
                <p className="text-sm font-semibold">No pending tasks right now.</p>
                <p className="text-xs mt-0.5">Press 'N' on your keyboard to create a new task.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const overdueDays = !isCompleted ? getOverdueDays(task.task_date, todayIST) : 0;
                const isOverdue = overdueDays > 0;
                const starCount = Math.min(overdueDays, 5);
                const isRecent = recentlyCompletedId === task.id;
                const isPlayingAudio = playingTaskId === task.id;

                const cardStyle = isCompleted
                  ? darkMode
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-100 opacity-80 hover:opacity-100'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950 opacity-90 hover:opacity-100'
                  : isOverdue
                  ? darkMode
                    ? 'bg-rose-950/30 border-rose-800/70 text-rose-100 ring-1 ring-rose-500/30'
                    : 'bg-rose-50/90 border-rose-300 text-slate-900 ring-1 ring-rose-300'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900';

                const assigneeStyle = task.assigned_to ? getAssigneeColor(task.assigned_to, darkMode) : null;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-5 rounded-2xl border shadow-sm cursor-pointer transition-all duration-300 transform flex flex-col justify-between ${
                      isRecent ? 'scale-95 opacity-50 ring-2 ring-emerald-500' : 'hover:-translate-y-0.5 hover:shadow-md'
                    } ${cardStyle}`}
                  >
                    <div>
                      {/* Top Header of Card: Overdue Stars (1-5) & Consistent Color-Coded Assignee Badge */}
                      {(isOverdue || task.assigned_to) && (
                        <div className={`flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
                          {isOverdue ? (
                            <div
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm ${
                                darkMode
                                  ? 'bg-rose-950/90 text-rose-100 border-rose-700'
                                  : 'bg-rose-100 text-rose-900 border-rose-300'
                              }`}
                              title={`Overdue by ${overdueDays} day(s)`}
                            >
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: starCount }).map((_, idx) => (
                                  <Star
                                    key={idx}
                                    className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0"
                                  />
                                ))}
                              </div>
                              <span className="text-[11px] font-extrabold uppercase tracking-tight">
                                {overdueDays}d Overdue
                              </span>
                            </div>
                          ) : (
                            <div />
                          )}

                          {task.assigned_to && assigneeStyle && (
                            <div
                              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-sm ${assigneeStyle.badgeClass}`}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${assigneeStyle.dotClass}`} />
                              <span className="truncate max-w-[140px]">{task.assigned_to}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleComplete(task.id);
                            }}
                            title={isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all duration-200 ${
                              isCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : darkMode
                                ? 'border-slate-600 bg-slate-800 hover:border-emerald-400'
                                : 'border-slate-300 bg-white hover:border-emerald-600'
                            }`}
                          >
                            {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              darkMode
                                ? 'bg-slate-800 text-slate-200 border-slate-700'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {getCategoryName(task.category)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => openEditModal(task, e)}
                            title="Edit Task"
                            className={`p-1.5 rounded-lg transition ${
                              darkMode
                                ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {task.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
                      </div>

                      <h3 className={`font-bold text-base mt-2 leading-snug transition-all ${isCompleted ? 'line-through opacity-75' : ''}`}>
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className={`text-xs mt-1 line-clamp-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {task.description}
                        </p>
                      )}

                      {/* Direct Voice Note Play Button on Dashboard Card */}
                      {task.audio_url && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={(e) => toggleCardAudio(e, task)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                              isPlayingAudio
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isPlayingAudio ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Stop Voice Note</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Play Voice Note</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${darkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{task.task_date}</span>
                        {isOverdue && (
                          <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                            Overdue
                          </span>
                        )}
                        {isCompleted && (
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${darkMode ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-200 text-emerald-900'}`}>
                            Done
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {task.audio_url && <Volume2 className="w-3.5 h-3.5 text-blue-500" />}
                        {task.remarks && task.remarks.length > 0 && (
                          <span className="text-[11px] font-semibold">{task.remarks.length} remarks</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Task Creation & Edit Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl border my-8 ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingTaskId ? 'Edit Task' : 'Create New Task'}</h2>
              <span className={`text-[11px] font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Esc to close</span>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Title *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Description (Optional)</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Task details..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>

              {/* Assigned To Field with Quick Add Person */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Assigned To (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineAddAssignee(!showInlineAddAssignee)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showInlineAddAssignee ? 'Select Existing' : 'Add New Person'}</span>
                  </button>
                </div>

                {!showInlineAddAssignee ? (
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="">Unassigned</option>
                    {allAssigneeOptions.map((person, idx) => (
                      <option key={idx} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inlineNewAssignee}
                      onChange={(e) => setInlineNewAssignee(e.target.value)}
                      placeholder="Enter person's name..."
                      className={`flex-1 px-3.5 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (inlineNewAssignee.trim()) {
                          handleAddAssigneePerson(inlineNewAssignee, true);
                          setInlineNewAssignee('');
                          setShowInlineAddAssignee(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                    >
                      Add & Select
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Category</label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    {categories.map((c, idx) => {
                      const name = getCategoryName(c);
                      return (
                        <option key={idx} value={name}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Task Date *</label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`block text-xs font-semibold uppercase ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Optional Voice Note</span>
                  {recordedAudio && (
                    <button
                      type="button"
                      onClick={() => setRecordedAudio(null)}
                      className="text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Remove Audio
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{recordedAudio ? 'Record Again' : 'Record Audio'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop ({recordDuration}s)</span>
                    </button>
                  )}
                  {recordedAudio && <audio src={recordedAudio} controls className="h-8 max-w-[220px]" />}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taskPinned}
                    onChange={(e) => setTaskPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Pin to Dashboard</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingTaskId(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${darkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
                  >
                    {editingTaskId ? 'Update Task' : 'Save Task'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Team / Assignees Modal */}
      {isManageTeamOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold">Manage Assignees</h2>
              </div>
              <button onClick={() => setIsManageTeamOpen(false)} className={darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newAssigneeName.trim()) {
                  handleAddAssigneePerson(newAssigneeName);
                  setNewAssigneeName('');
                }
              }}
              className="flex gap-2 mb-4"
            >
              <input
                type="text"
                value={newAssigneeName}
                onChange={(e) => setNewAssigneeName(e.target.value)}
                placeholder="Add person name..."
                className={`flex-1 px-3.5 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'}`}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
              >
                Add Person
              </button>
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {allAssigneeOptions.length === 0 ? (
                <p className={`text-xs text-center py-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No assignees added yet.</p>
              ) : (
                allAssigneeOptions.map((person, idx) => {
                  const pColor = getAssigneeColor(person, darkMode);
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-sm ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${pColor.badgeClass}`}>
                          <span className={`w-2 h-2 rounded-full ${pColor.dotClass}`} />
                          <span>{person}</span>
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveAssigneePerson(person)}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsManageTeamOpen(false)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'}`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details & Remarks Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-xl p-6 rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${darkMode ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-blue-100 text-blue-900 border-blue-300'}`}>
                    {getCategoryName(selectedTask.category)}
                  </span>
                  {selectedTask.assigned_to && (() => {
                    const modalAssigneeStyle = getAssigneeColor(selectedTask.assigned_to, darkMode);
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${modalAssigneeStyle.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${modalAssigneeStyle.dotClass}`} />
                        <span>Assigned to: {selectedTask.assigned_to}</span>
                      </span>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-bold mt-2">{selectedTask.title}</h2>
                <p className={`text-xs mt-0.5 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Due: {selectedTask.task_date} &bull; Priority: {selectedTask.priority || 'Medium'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => openEditModal(selectedTask, e)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${darkMode ? 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900' : 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200'}`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className={`text-sm font-bold px-1.5 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  ✕
                </button>
              </div>
            </div>

            {selectedTask.description && (
              <p className={`text-sm mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedTask.description}</p>
            )}

            {selectedTask.audio_url && (
              <div className={`mb-4 p-3 rounded-xl border ${darkMode ? 'border-blue-800 bg-blue-950/40' : 'border-blue-200 bg-blue-50'}`}>
                <span className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Attached Voice Note</span>
                <audio src={selectedTask.audio_url} controls className="w-full h-8" />
              </div>
            )}

            {/* High-Contrast Remarks History Section */}
            <div className={`border-t pt-4 mb-4 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Remarks History</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                {!selectedTask.remarks || selectedTask.remarks.length === 0 ? (
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No remarks yet.</p>
                ) : (
                  selectedTask.remarks.map((r, i) => (
                    <div
                      key={r.id || i}
                      className={`p-3 rounded-xl border text-xs ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-100'
                          : 'bg-slate-100 border-slate-300 text-slate-900'
                      }`}
                    >
                      <p className="font-semibold leading-relaxed">{r.text}</p>
                      <span className={`text-[10px] mt-1 block font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Form submission allows pressing Enter key to immediately add the remark */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddRemark(selectedTask.id);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Type a remark and press Enter..."
                  value={newRemarkText}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                  className={`flex-1 px-3.5 py-2 rounded-xl text-xs border outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm"
                >
                  Add
                </button>
              </form>
            </div>

            <div className={`flex items-center justify-between pt-3 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                onClick={() => moveToTrash(selectedTask.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
              <button
                onClick={() => setSelectedTask(null)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
