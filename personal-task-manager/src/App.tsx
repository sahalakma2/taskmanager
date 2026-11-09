import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, CheckSquare, Calendar as CalendarIcon, Pin, Clock, AlertCircle,
  Trash2, Plus, Search, Mic, Square, Check, LogOut, Volume2, Sun, Moon, DownloadCloud,
  Sparkles
} from 'lucide-react';

const FIREBASE_URL = 'https://mytasks-52442-default-rtdb.firebaseio.com';

const getCategoryName = (cat: any): string => {
  if (!cat) return 'General';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object' && cat.name) return String(cat.name);
  return 'General';
};

// Play a pleasant success chime using the Web Audio API
const playCompletionSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First high chime note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second harmonizing higher chime note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
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

  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState('Work');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [taskPriority, setTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [taskPinned, setTaskPinned] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

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
        setSelectedTask(null);
        return;
      }

      if ((e.key === 'n' || e.key === 'N') && !isInputActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isAuthenticated) {
          e.preventDefault();
          setIsCreateOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

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
      localStorage.setItem('apex_theme', darkMode ? 'dark' : 'light');
    } catch (e) {
      console.error(e);
    }
  }, [darkMode]);

  // Safe Firebase Fetch on Mount
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

  const saveToFirebase = async (updatedTasks: Task[], updatedCategories: string[]) => {
    try {
      setSyncStatus('Saving...');
      await fetch(`${FIREBASE_URL}/apextask_workspace.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: updatedTasks,
          categories: updatedCategories,
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

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

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
      audio_url: recordedAudio || undefined,
      remarks: [],
      recurrence: 'none',
      created_at: new Date().toISOString()
    };

    const nextTasks = [newTask, ...tasks];
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories);

    setTaskTitle('');
    setTaskDesc('');
    setRecordedAudio(null);
    setTaskPinned(false);
    setIsCreateOpen(false);
  };

  // Complete task with sound effect and smooth exit from dashboard
  const toggleComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
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
    saveToFirebase(nextTasks, categories);
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
    saveToFirebase(nextTasks, categories);
    setNewRemarkText('');

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, remarks: [...(prev.remarks || []), newRemark] } : null));
    }
  };

  const moveToTrash = (taskId: string) => {
    const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, is_deleted: true } : t));
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories);
    setSelectedTask(null);
  };

  const restoreFromTrash = (taskId: string) => {
    const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, is_deleted: false } : t));
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories);
  };

  const permanentlyDelete = (taskId: string) => {
    if (!confirm('Permanently delete this task?')) return;
    const nextTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(nextTasks);
    saveToFirebase(nextTasks, categories);
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const activeTasks = useMemo(() => safeTasks.filter((t) => !t.is_deleted), [safeTasks]);
  const trashedTasks = useMemo(() => safeTasks.filter((t) => t.is_deleted), [safeTasks]);

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
          (t.remarks && t.remarks.some((r) => r.text && r.text.toLowerCase().includes(q)))
      );
    }

    if (selectedCategory !== 'All') {
      list = list.filter((t) => getCategoryName(t.category) === selectedCategory);
    }

    if (selectedPriority !== 'All') {
      list = list.filter((t) => t.priority === selectedPriority);
    }

    // Sorting rule: Incomplete tasks stay at the top (Overdue first, then Today's),
    // and Completed tasks automatically sink to the bottom in sections where they are visible
    return [...list].sort((a, b) => {
      const aDone = a.status === 'completed' ? 1 : 0;
      const bDone = b.status === 'completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      if (aDone === 0) {
        const aOverdue = a.task_date < todayIST ? 1 : 0;
        const bOverdue = b.task_date < todayIST ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      }
      return b.task_date.localeCompare(a.task_date);
    });
  }, [activeTasks, activeSection, todayIST, searchQuery, selectedCategory, selectedPriority, recentlyCompletedId]);

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
      <div className={`min-h-screen flex items-center justify-center p-4 ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl shadow-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ApexTask</h1>
              <p className="text-xs text-slate-400">Admin Login</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin@2026"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
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
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {syncStatus}
                </span>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>

          <button
            onClick={handleInstallClick}
            className={`w-full mb-4 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
              darkMode
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <DownloadCloud className="w-4 h-4 text-blue-500" />
            <span>Install Desktop App</span>
          </button>

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
                      ? 'bg-blue-600 text-white'
                      : darkMode
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-700 text-white' : darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-slate-500/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Shortcut:</span>
            <span className="font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">N</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition"
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
            <p className="text-xs text-slate-400 mt-0.5">
              {activeSection === 'dashboard'
                ? `Prioritizing Today's Pending Tasks & Overdue Items • Asia/Kolkata (${todayIST})`
                : `Asia/Kolkata (IST) • ${todayIST}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateOpen(true)}
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
              { label: 'Total Tasks', value: stats.total, color: 'text-blue-500' },
              { label: "Today's Focus", value: stats.today, color: 'text-indigo-500' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-500' },
              { label: 'Completed', value: stats.completed, color: 'text-emerald-500' },
              { label: 'Overdue Pending', value: stats.overdue, color: 'text-rose-500' },
              { label: 'Completion', value: `${stats.rate}%`, color: 'text-emerald-500' }
            ].map((stat, i) => (
              <div key={i} className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</span>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks, descriptions, remarks... (Press 'N' to Add)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border outline-none ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
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
              className={`px-3 py-2 rounded-xl text-xs font-medium border outline-none ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
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
              <p className="text-center py-12 text-slate-400 text-sm">Trash is empty.</p>
            ) : (
              trashedTasks.map((task) => (
                <div key={task.id} className={`p-4 rounded-xl border flex items-center justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div>
                    <h3 className="font-semibold text-sm line-through text-slate-400">{task.title}</h3>
                    <span className="text-xs text-slate-400">{getCategoryName(task.category)} &bull; {task.task_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreFromTrash(task.id)}
                      className="px-3 py-1.5 bg-blue-600/10 text-blue-500 rounded-lg text-xs font-medium hover:bg-blue-600/20"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => permanentlyDelete(task.id)}
                      className="px-3 py-1.5 bg-red-600/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-600/20"
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
              <div className="col-span-full text-center py-16 text-slate-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500" />
                <p className="text-sm font-medium">No pending tasks right now.</p>
                <p className="text-xs opacity-75 mt-0.5">Press 'N' on your keyboard to create a new task.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isOverdue = !isCompleted && task.task_date < todayIST;
                const isRecent = recentlyCompletedId === task.id;

                const cardStyle = isCompleted
                  ? darkMode
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200 opacity-75 hover:opacity-100'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900 opacity-80 hover:opacity-100'
                  : isOverdue
                  ? darkMode
                    ? 'bg-rose-950/20 border-rose-800/40 text-rose-200 ring-1 ring-rose-500/30'
                    : 'bg-rose-50 border-rose-200 text-rose-900 ring-1 ring-rose-400/40'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900';

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-5 rounded-2xl border shadow-sm cursor-pointer transition-all duration-300 transform flex flex-col justify-between ${
                      isRecent ? 'scale-95 opacity-50 ring-2 ring-emerald-500' : 'hover:-translate-y-0.5 hover:shadow-md'
                    } ${cardStyle}`}
                  >
                    <div>
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
                                : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10'
                            }`}
                          >
                            {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>
                          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-500/10">
                            {getCategoryName(task.category)}
                          </span>
                        </div>
                        {task.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      </div>

                      <h3 className={`font-semibold text-base mt-2 leading-snug transition-all ${isCompleted ? 'line-through opacity-70' : ''}`}>
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-xs opacity-75 mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-current/10 flex items-center justify-between text-xs opacity-80">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.task_date}</span>
                        {isOverdue && (
                          <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                            Overdue
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                            Done
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {task.audio_url && <Volume2 className="w-3.5 h-3.5 text-blue-500" />}
                        {task.remarks && task.remarks.length > 0 && (
                          <span className="text-[11px] font-medium">{task.remarks.length} remarks</span>
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

      {/* Task Creation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Create New Task</h2>
              <span className="text-[11px] text-slate-400 font-mono">Esc to close</span>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Task details..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Category</label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
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
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Task Date *</label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-xs font-semibold uppercase text-slate-400 mb-2">Optional Voice Note</span>
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-medium hover:bg-rose-600"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Record Audio</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop ({recordDuration}s)</span>
                    </button>
                  )}
                  {recordedAudio && <audio src={recordedAudio} controls className="h-8 max-w-[200px]" />}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
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
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
                  >
                    Save Task
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details & Remarks Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-xl p-6 rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                  {getCategoryName(selectedTask.category)}
                </span>
                <h2 className="text-xl font-bold mt-2">{selectedTask.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Due: {selectedTask.task_date}</p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            {selectedTask.description && <p className="text-sm opacity-80 mb-4">{selectedTask.description}</p>}

            {selectedTask.audio_url && (
              <div className="mb-4 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <span className="block text-xs font-semibold text-blue-500 mb-1">Attached Voice Note</span>
                <audio src={selectedTask.audio_url} controls className="w-full h-8" />
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Remarks</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                {!selectedTask.remarks || selectedTask.remarks.length === 0 ? (
                  <p className="text-xs text-slate-400">No remarks yet.</p>
                ) : (
                  selectedTask.remarks.map((r, i) => (
                    <div key={r.id || i} className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                      <p className="font-medium">{r.text}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a remark..."
                  value={newRemarkText}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                />
                <button
                  onClick={() => handleAddRemark(selectedTask.id)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => moveToTrash(selectedTask.id)}
                className="flex items-center gap-1.5 text-xs text-rose-500 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-800"
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
