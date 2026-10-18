import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Search,
  Activity,
  Layers,
  Sparkles,
  Server,
  FolderGit2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Flame,
  CheckCircle,
  FileCode,
  Terminal,
  X,
  SlidersHorizontal,
} from 'lucide-react';

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export interface HealthData {
  status: string;
  message: string;
  database: string;
  engine: string;
  total_records?: number;
  total_tasks_stored?: number;
  timestamp?: string;
  server_time?: string;
}

export default function App() {
  // Use relative '/api' by default so it connects to the full-stack SQLite backend in AI Studio,
  // or user can switch to 'http://127.0.0.1:8000' for testing their local FastAPI backend!
  const [apiBase, setApiBase] = useState<string>(() => {
    return localStorage.getItem('student_task_api_base') || '';
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'title' | 'id'>('due_date');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState<boolean>(false);
  const [isProjectFilesModalOpen, setIsProjectFilesModalOpen] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium' as 'high' | 'medium' | 'low',
  });

  // Health Status
  const [healthInfo, setHealthInfo] = useState<{
    ok: boolean;
    data?: HealthData;
    error?: string;
    latency: number;
    checkedAt: string;
  } | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  // Active file for project viewer modal
  const [selectedViewerFile, setSelectedViewerFile] = useState<string>('main.py');
  const [copiedFileName, setCopiedFileName] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const getFullUrl = useCallback((path: string) => {
    if (!apiBase || apiBase.trim() === '') {
      return path;
    }
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    return `${cleanBase}${path}`;
  }, [apiBase]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(getFullUrl('/api/stats'));
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Could not update stats:', err);
    }
  }, [getFullUrl]);

  // Fetch Tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const url = `${getFullUrl('/api/tasks')}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API responded with HTTP ${res.status}: ${res.statusText}`);
      }
      const data: Task[] = await res.json();
      setTasks(data);
      await fetchStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Backend request failed: ${msg}. Click "Check Connection" to test connectivity.`);
    } finally {
      setLoading(false);
    }
  }, [getFullUrl, statusFilter, priorityFilter, searchQuery, fetchStats]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Test Backend Connection
  const checkHealth = useCallback(async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await fetch(getFullUrl('/api/health'));
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data: HealthData = await res.json();
        setHealthInfo({
          ok: true,
          data,
          latency,
          checkedAt: new Date().toLocaleTimeString(),
        });
        showToast(`Backend online (${latency}ms) - SQLite connected!`, 'success');
      } else {
        const text = await res.text();
        setHealthInfo({
          ok: false,
          error: `HTTP ${res.status} ${res.statusText}: ${text}`,
          latency,
          checkedAt: new Date().toLocaleTimeString(),
        });
        showToast(`Backend responded with error ${res.status}`, 'error');
      }
    } catch (err: unknown) {
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : String(err);
      setHealthInfo({
        ok: false,
        error: msg,
        latency,
        checkedAt: new Date().toLocaleTimeString(),
      });
      showToast(`Cannot reach backend: ${msg}`, 'error');
    } finally {
      setIsPinging(false);
    }
  }, [getFullUrl]);

  // Run initial health check on mount
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Toggle completion
  const handleToggleComplete = async (task: Task) => {
    try {
      const res = await fetch(getFullUrl(`/api/tasks/${task.id}/complete`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!res.ok) throw new Error('Failed to toggle completion status');
      const updated: Task = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      fetchStats();
      showToast(
        updated.completed ? `✓ Marked "${updated.title}" as completed!` : `Moved "${updated.title}" to pending.`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Status update failed: ${msg}`, 'error');
    }
  };

  // Add 3+ Sample Student Tasks via API
  const handleSeedSampleTasks = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(getFullUrl('/api/seed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to seed sample student tasks');
      const data = await res.json();
      showToast(data.message || 'Added sample student coursework tasks!', 'success');
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to seed tasks: ${msg}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      due_date: new Date().toISOString().split('T')[0],
      priority: 'medium',
    });
    setIsTaskModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority,
    });
    setIsTaskModalOpen(true);
  };

  // Submit Task (Create or Update)
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (editingTask) {
        // PUT update
        const res = await fetch(getFullUrl(`/api/tasks/${editingTask.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error('Failed to update task');
        showToast('Task updated in SQLite database!', 'success');
      } else {
        // POST create
        const res = await fetch(getFullUrl('/api/tasks'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error('Failed to create task');
        showToast('New student task stored in SQLite!', 'success');
      }
      setIsTaskModalOpen(false);
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Save failed: ${msg}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Task
  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setActionLoading(true);
    try {
      const res = await fetch(getFullUrl(`/api/tasks/${deletingTask.id}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      showToast(`Deleted "${deletingTask.title}" from database.`, 'info');
      setDeletingTask(null);
      await fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Delete failed: ${msg}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: check if overdue
  const checkIsOverdue = (task: Task) => {
    if (task.completed || !task.due_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today;
  };

  // Helper: check if due today
  const checkIsDueToday = (task: Task) => {
    if (task.completed || !task.due_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return task.due_date === today;
  };

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'id') {
        return b.id - a.id;
      }
      // default: due_date
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }, [tasks, sortBy]);

  // Project code viewer samples
  const projectCodeFiles: Record<string, { lang: string; path: string; code: string }> = {
    'main.py': {
      lang: 'python',
      path: 'backend/main.py',
      code: `from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import database

app = FastAPI(title="AI Student Task Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    database.init_db()

@app.get("/api/health")
def health():
    return {"status": "ok", "database": "connected", "engine": "SQLite3"}

@app.get("/api/stats")
def stats():
    return database.get_stats()

@app.get("/api/tasks")
def list_tasks(status: Optional[str] = None, priority: Optional[str] = None, search: Optional[str] = None):
    return database.get_all_tasks(status=status, priority=priority, search=search)

@app.get("/api/tasks/{task_id}")
def get_task(task_id: int):
    task = database.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/api/tasks", status_code=201)
def create(payload: TaskCreate):
    return database.create_task(payload.title, payload.description, payload.due_date, payload.priority)

@app.put("/api/tasks/{task_id}")
def update(task_id: int, payload: TaskUpdate):
    updated = database.update_task(task_id, payload.title, payload.description, payload.due_date, payload.priority, payload.completed)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated

@app.patch("/api/tasks/{task_id}/complete")
def toggle(task_id: int):
    updated = database.toggle_task_completion(task_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated

@app.delete("/api/tasks/{task_id}")
def delete(task_id: int):
    if not database.delete_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully", "id": task_id}`,
    },
    'database.py': {
      lang: 'python',
      path: 'backend/database.py',
      code: `import sqlite3, os
from datetime import datetime, date

DB_FILE = os.path.join(os.path.dirname(__file__), "student_tasks.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                due_date TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                completed BOOLEAN NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()`,
    },
    'requirements.txt': {
      lang: 'text',
      path: 'backend/requirements.txt',
      code: `fastapi>=0.110.0\nuvicorn[standard]>=0.28.0\npydantic>=2.0.0`,
    },
    'Windows Commands': {
      lang: 'powershell',
      path: 'Terminal Commands',
      code: `# Windows Backend Start:
cd backend
python -m venv venv
.\\venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Windows Frontend Start:
cd frontend
npm install
npm run dev

# Test Endpoint:
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" | ConvertTo-Json`,
    },
  };

  const copyCodeToClipboard = (filename: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFileName(filename);
    setTimeout(() => setCopiedFileName(null), 2500);
    showToast(`Copied ${filename} code to clipboard!`, 'success');
  };

  // Completion percentage
  const completionPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
      {/* Sidebar */}
      <aside className="hidden w-72 flex-shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/95 p-5 md:flex">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 shadow-lg shadow-blue-500/25">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">AI Student Tasks</h1>
            <p className="text-xs font-medium text-slate-400">FastAPI • SQLite • React</p>
          </div>
        </div>

        {/* Progress Card */}
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Course Progress</span>
            <span className="font-semibold text-blue-400">{completionPercentage}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {stats.completed} of {stats.total} assignments completed
          </div>
        </div>

        {/* Navigation / Status Filter */}
        <div className="space-y-1">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Status Filters
          </div>

          <button
            onClick={() => setStatusFilter('all')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Layers className="h-4 w-4" /> All Tasks
            </span>
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-slate-300">
              {stats.total}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
              statusFilter === 'pending'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-sky-400" /> Pending
            </span>
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-slate-300">
              {stats.pending}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CheckCircle className="h-4 w-4 text-emerald-400" /> Completed
            </span>
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-slate-300">
              {stats.completed}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('overdue')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
              statusFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400" /> Overdue
            </span>
            <span className="rounded-full bg-rose-950/80 px-2 py-0.5 text-xs font-semibold text-rose-300">
              {stats.overdue}
            </span>
          </button>
        </div>

        {/* Priority Filter */}
        <div className="mt-6 space-y-1">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Priority Filter
          </div>

          <button
            onClick={() => setPriorityFilter('all')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              priorityFilter === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span>All Priorities</span>
          </button>

          <button
            onClick={() => setPriorityFilter('high')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              priorityFilter === 'high' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> High Priority
            </span>
          </button>

          <button
            onClick={() => setPriorityFilter('medium')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              priorityFilter === 'medium' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium Priority
            </span>
          </button>

          <button
            onClick={() => setPriorityFilter('low')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              priorityFilter === 'low' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Low Priority
            </span>
          </button>
        </div>

        {/* Sidebar Footer with Diagnostics */}
        <div className="mt-auto border-t border-slate-800/80 pt-4">
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">SQLite Database</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    healthInfo?.ok ? 'bg-emerald-500 shadow-sm shadow-emerald-500/80' : 'bg-rose-500'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-400">
                  {healthInfo?.ok ? 'Connected' : 'Offline'}
                </span>
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400">
              Engine: <span className="font-mono text-slate-300">{healthInfo?.data?.engine || 'SQLite3'}</span>
            </div>
            <button
              onClick={() => setIsHealthModalOpen(true)}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Activity className="h-3.5 w-3.5 text-blue-400" /> Health Diagnostics
            </button>
          </div>

          <button
            onClick={() => setIsProjectFilesModalOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-900/60 bg-indigo-950/30 px-2 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-900/40"
          >
            <FolderGit2 className="h-3.5 w-3.5" /> View Project Code & Run
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-white">Student Task Dashboard</h2>
              <span className="hidden rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 sm:inline-flex">
                Persistent SQLite
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Track coursework, assignment milestones, and study schedules.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSeedSampleTasks}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
              title="Add 3+ realistic student coursework tasks"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Add Sample Tasks</span>
            </button>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </button>

            <button
              onClick={() => setIsHealthModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 md:hidden"
            >
              <Server className="h-3.5 w-3.5 text-emerald-400" />
            </button>
          </div>
        </header>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards Grid */}
          <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4 transition hover:border-slate-700">
              <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Tasks</span>
                <Layers className="h-4 w-4 text-blue-400" />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-white">{stats.total}</div>
              <div className="mt-1 text-[11px] text-slate-500">All registered course items</div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4 transition hover:border-slate-700">
              <div className="absolute top-0 left-0 h-1 w-full bg-sky-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Pending</span>
                <Clock className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-sky-400">{stats.pending}</div>
              <div className="mt-1 text-[11px] text-slate-500">In progress or upcoming</div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4 transition hover:border-slate-700">
              <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Completed</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-400">{stats.completed}</div>
              <div className="mt-1 text-[11px] text-slate-500">{completionPercentage}% completion rate</div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4 transition hover:border-slate-700">
              <div className="absolute top-0 left-0 h-1 w-full bg-rose-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Overdue</span>
                <AlertTriangle className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-rose-400">{stats.overdue}</div>
              <div className="mt-1 text-[11px] text-rose-400/80">Requires immediate attention</div>
            </div>
          </section>

          {/* Search, Filter & Sort Toolbar */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks by title or course description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pr-3 pl-9 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Statuses ({stats.total})</option>
              <option value="pending">Pending ({stats.pending})</option>
              <option value="completed">Completed ({stats.completed})</option>
              <option value="overdue">Overdue ({stats.overdue})</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="due_date">Sort by Due Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="title">Sort by Title</option>
                <option value="id">Sort by Newest</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(statusFilter !== 'all' || priorityFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setSearchQuery('');
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                Reset
              </button>
            )}

            <button
              onClick={() => fetchTasks()}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
              title="Refresh task list from SQLite"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Connection Error Banner */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 text-xs text-rose-200">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400" />
              <div className="flex-1">
                <div className="font-semibold text-rose-300">Backend Communication Notice</div>
                <div className="mt-0.5">{error}</div>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={checkHealth}
                    className="rounded bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-600"
                  >
                    Check Health Now
                  </button>
                  <button
                    onClick={() => {
                      setApiBase('');
                      localStorage.removeItem('student_task_api_base');
                      setTimeout(fetchTasks, 100);
                    }}
                    className="text-[11px] underline text-rose-300 hover:text-white"
                  >
                    Reset to default host
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Task List Section */}
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 py-16 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              <p className="mt-3 text-sm font-medium text-slate-400">Loading tasks from SQLite database...</p>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
                <Layers className="h-7 w-7 text-slate-500" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-200">No tasks found</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No coursework items match your current filter and search conditions.'
                  : 'Your student task queue is empty. Create your first task or seed realistic coursework assignments!'}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" /> Add Academic Task
                </button>
                <button
                  onClick={handleSeedSampleTasks}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Seed Sample Tasks
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => {
                const overdue = checkIsOverdue(task);
                const dueToday = checkIsDueToday(task);

                return (
                  <div
                    key={task.id}
                    className={`group relative flex items-start justify-between gap-4 rounded-xl border p-4 transition-all ${
                      task.completed
                        ? 'border-slate-800/60 bg-slate-900/30 opacity-70'
                        : overdue
                        ? 'border-rose-900/60 bg-slate-900/90 shadow-sm shadow-rose-950/40 hover:border-rose-700'
                        : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    {/* Left Checkbox & Task Info */}
                    <div className="flex flex-1 items-start gap-3.5">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition ${
                          task.completed
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-600 bg-slate-950 text-transparent hover:border-blue-400'
                        }`}
                        title={task.completed ? 'Mark as pending' : 'Mark as completed'}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-sm font-semibold tracking-tight text-white ${
                              task.completed ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>

                          {/* Priority Badge */}
                          {task.priority === 'high' && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                              <Flame className="h-3 w-3" /> High
                            </span>
                          )}
                          {task.priority === 'medium' && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                              <Clock className="h-3 w-3" /> Medium
                            </span>
                          )}
                          {task.priority === 'low' && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              <CheckCircle className="h-3 w-3" /> Low
                            </span>
                          )}

                          {/* Overdue / Due Today status pills */}
                          {overdue && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-600/50 bg-rose-600/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                              <AlertTriangle className="h-3 w-3" /> Overdue
                            </span>
                          )}
                          {dueToday && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              <Clock className="h-3 w-3" /> Due Today
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          {task.due_date && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>Due {task.due_date}</span>
                            </span>
                          )}
                          <span className="font-mono text-slate-500">ID #{task.id}</span>
                          {task.created_at && (
                            <span className="text-slate-600">
                              Added {new Date(task.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-90 transition group-hover:opacity-100">
                      <button
                        onClick={() => openEditModal(task)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        title="Edit task"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setDeletingTask(task)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-950/60 hover:text-rose-400"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Task Modal */}
      {isTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">
                {editingTask ? 'Edit Academic Task' : 'Create New Academic Task'}
              </h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS301 Operating Systems Assignment 2"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description / Study Deliverables
                </label>
                <textarea
                  rows={3}
                  placeholder="Mention problem set questions, team members, or specific chapter requirements..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{editingTask ? 'Save Changes' : 'Create Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setDeletingTask(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Delete Academic Task</h3>
            </div>

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete this task from the SQLite database? This operation cannot be undone.
            </p>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs font-medium text-slate-200">
              "{deletingTask.title}"
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500"
              >
                {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backend Health Diagnostics Modal */}
      {isHealthModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setIsHealthModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Backend Health Diagnostics</h3>
              </div>
              <button
                onClick={() => setIsHealthModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Endpoint Status Pill */}
              <div
                className={`rounded-xl border p-4 ${
                  healthInfo?.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        healthInfo?.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                      }`}
                    />
                    <span
                      className={`text-sm font-bold ${
                        healthInfo?.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {healthInfo?.ok ? 'API Online & Operational' : 'API Connection Issue'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-300">
                    {healthInfo ? `${healthInfo.latency} ms` : '--'}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-300">
                  {healthInfo?.ok
                    ? healthInfo.data?.message || 'FastAPI + SQLite backend responded with HTTP 200 OK.'
                    : healthInfo?.error || 'Unable to connect to the backend server.'}
                </div>
              </div>

              {/* Raw JSON Payload */}
              {healthInfo?.ok && healthInfo.data && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    GET /api/health Payload
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-300">
                    {JSON.stringify(healthInfo.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Backend URL Configuration */}
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Target Backend API Base URL
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                    placeholder="Leave empty for integrated backend or enter http://127.0.0.1:8000"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      localStorage.setItem('student_task_api_base', apiBase);
                      checkHealth();
                      fetchTasks();
                    }}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Save & Test
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setApiBase('');
                      localStorage.removeItem('student_task_api_base');
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:text-white"
                  >
                    Use Integrated Backend
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApiBase('http://127.0.0.1:8000');
                      localStorage.setItem('student_task_api_base', 'http://127.0.0.1:8000');
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:text-white"
                  >
                    Use Local FastAPI (http://127.0.0.1:8000)
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-[11px] text-slate-500">
                Last checked: {healthInfo?.checkedAt || 'Never'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsHealthModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={checkHealth}
                  disabled={isPinging}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>Re-test Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Project Files & VS Code Execution Modal */}
      {isProjectFilesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setIsProjectFilesModalOpen(false)}
        >
          <div
            className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <FileCode className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Generated Project Files & VS Code Setup</h3>
                  <p className="text-xs text-slate-400">All standalone FastAPI & React files in student-task-manager/</p>
                </div>
              </div>
              <button
                onClick={() => setIsProjectFilesModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Tabs & Code Viewer */}
            <div className="flex flex-1 overflow-hidden">
              {/* File list sidebar */}
              <div className="w-56 border-r border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Project Files
                </div>
                {Object.keys(projectCodeFiles).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setSelectedViewerFile(fileName)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                      selectedViewerFile === fileName
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {fileName.endsWith('.py') ? (
                        <Terminal className="h-3.5 w-3.5 text-yellow-400" />
                      ) : (
                        <FileCode className="h-3.5 w-3.5 text-blue-400" />
                      )}
                      {fileName}
                    </span>
                  </button>
                ))}
              </div>

              {/* Code viewer display */}
              <div className="flex flex-1 flex-col overflow-hidden bg-slate-950 p-4">
                <div className="flex items-center justify-between pb-3">
                  <div className="font-mono text-xs text-slate-400">
                    Path: <span className="text-slate-200">{projectCodeFiles[selectedViewerFile].path}</span>
                  </div>
                  <button
                    onClick={() =>
                      copyCodeToClipboard(selectedViewerFile, projectCodeFiles[selectedViewerFile].code)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                  >
                    {copiedFileName === selectedViewerFile ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Code
                      </>
                    )}
                  </button>
                </div>

                <pre className="flex-1 overflow-auto rounded-xl border border-slate-800/80 bg-slate-900/90 p-4 font-mono text-xs text-slate-300">
                  {projectCodeFiles[selectedViewerFile].code}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-950/40">
              <span className="text-xs text-slate-400">
                Ready for VS Code: Follow commands in <span className="font-mono text-indigo-400">README.md</span> to run locally in ~10 mins.
              </span>
              <button
                onClick={() => setIsProjectFilesModalOpen(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'border-emerald-500/50 bg-slate-900/95 text-emerald-300 shadow-emerald-500/10'
              : toast.type === 'error'
              ? 'border-rose-500/50 bg-slate-900/95 text-rose-300 shadow-rose-500/10'
              : 'border-blue-500/50 bg-slate-900/95 text-blue-300 shadow-blue-500/10'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="h-4 w-4 text-rose-400" />}
          {toast.type === 'info' && <Activity className="h-4 w-4 text-blue-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
