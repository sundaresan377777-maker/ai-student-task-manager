import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Default API Base URL for local FastAPI backend
const DEFAULT_API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [apiBase, setApiBase] = useState(() => {
    return localStorage.getItem('task_api_base') || DEFAULT_API_BASE;
  });
  
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters and search
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthChecking, setHealthChecking] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
  });

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Failed to fetch statistics:', err);
    }
  }, [apiBase]);

  // Fetch Tasks with filters
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const url = `${apiBase}/api/tasks${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setTasks(data);
      fetchStats();
    } catch (err) {
      setError(`Cannot connect to backend at ${apiBase}. Ensure FastAPI is running on port 8000.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, statusFilter, priorityFilter, searchQuery, fetchStats]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Health check button handler
  const checkBackendHealth = async () => {
    setHealthChecking(true);
    setIsHealthModalOpen(true);
    setHealthStatus(null);
    const start = performance.now();
    try {
      const res = await fetch(`${apiBase}/api/health`);
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        setHealthStatus({ ok: true, data, latency });
      } else {
        setHealthStatus({ ok: false, error: `HTTP ${res.status} ${res.statusText}`, latency });
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setHealthStatus({ ok: false, error: err.message, latency });
    } finally {
      setHealthChecking(false);
    }
  };

  // Add 3+ Sample Student Tasks through the API
  const handleAddSampleTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to seed sample tasks');
      showToast('Added realistic sample student coursework tasks!');
      await fetchTasks();
    } catch (err) {
      showToast(`Error seeding tasks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle completion
  const handleToggleComplete = async (task) => {
    try {
      const res = await fetch(`${apiBase}/api/tasks/${task.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to update task completion');
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      fetchStats();
      showToast(updated.completed ? 'Task marked as completed!' : 'Task moved to pending.');
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`);
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
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority || 'medium',
    });
    setIsAddModalOpen(true);
  };

  // Save Task (Create or Update)
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Please enter a task title.');
      return;
    }

    try {
      if (editingTask) {
        // PUT update
        const res = await fetch(`${apiBase}/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            due_date: formData.due_date,
            priority: formData.priority,
          }),
        });
        if (!res.ok) throw new Error('Failed to update task');
        showToast('Task updated successfully!');
      } else {
        // POST create
        const res = await fetch(`${apiBase}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error('Failed to create task');
        showToast('New student task created!');
      }
      setIsAddModalOpen(false);
      fetchTasks();
    } catch (err) {
      showToast(`Save failed: ${err.message}`);
    }
  };

  // Delete Task
  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    try {
      const res = await fetch(`${apiBase}/api/tasks/${deletingTask.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      showToast('Task deleted successfully.');
      setDeletingTask(null);
      fetchTasks();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`);
    }
  };

  // Format Date Helper
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const isOverdue = (task) => {
    if (task.completed || !task.due_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today;
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🎓</div>
          <div>
            <div className="brand-title">AI Student Tasks</div>
            <div className="brand-subtitle">FastAPI + SQLite Backend</div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Views & Filters</div>
          <button
            className={`nav-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>📚 All Tasks</span>
            <span className="nav-count">{stats.total}</span>
          </button>
          <button
            className={`nav-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <span>⏳ Pending</span>
            <span className="nav-count">{stats.pending}</span>
          </button>
          <button
            className={`nav-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            <span>✅ Completed</span>
            <span className="nav-count">{stats.completed}</span>
          </button>
          <button
            className={`nav-btn ${statusFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => setStatusFilter('overdue')}
          >
            <span>🚨 Overdue</span>
            <span className="nav-count">{stats.overdue}</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-label">Priority Filter</div>
          <button
            className={`nav-btn ${priorityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('all')}
          >
            <span>All Priorities</span>
          </button>
          <button
            className={`nav-btn ${priorityFilter === 'high' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('high')}
          >
            <span style={{ color: 'var(--priority-high)' }}>● High Priority</span>
          </button>
          <button
            className={`nav-btn ${priorityFilter === 'medium' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('medium')}
          >
            <span style={{ color: 'var(--priority-med)' }}>● Medium Priority</span>
          </button>
          <button
            className={`nav-btn ${priorityFilter === 'low' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('low')}
          >
            <span style={{ color: 'var(--priority-low)' }}>● Low Priority</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="server-status-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 600 }}>Backend Connection</span>
              <span className={`status-indicator ${error ? 'status-offline' : 'status-online'}`} />
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {apiBase}
            </div>
            <button
              onClick={checkBackendHealth}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.6rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
            >
              🔍 Test Connection
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="top-bar">
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Academic Task Dashboard</h1>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Organize study assignments, milestones, and project deadlines with persistent SQLite storage.
            </p>
          </div>

          <div className="actions-row">
            <button onClick={handleAddSampleTasks} className="btn btn-secondary" title="Add 3 sample course tasks via API">
              ✨ Add Sample Tasks
            </button>
            <button onClick={openCreateModal} className="btn btn-primary">
              ＋ Add New Task
            </button>
          </div>
        </header>

        <main className="content-body">
          {/* Dashboard Statistics */}
          <section className="stats-grid">
            <div className="stat-card stat-total">
              <div className="stat-title">Total Tasks</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-card stat-pending">
              <div className="stat-title">Pending Tasks</div>
              <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.pending}</div>
            </div>
            <div className="stat-card stat-completed">
              <div className="stat-title">Completed Tasks</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.completed}</div>
            </div>
            <div className="stat-card stat-overdue">
              <div className="stat-title">Overdue Tasks</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{stats.overdue}</div>
            </div>
          </section>

          {/* Search & Filter Toolbar */}
          <div className="filter-bar">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search tasks by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Only</option>
              <option value="completed">Completed Only</option>
              <option value="overdue">Overdue Only</option>
            </select>

            <select
              className="filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            {(statusFilter !== 'all' || priorityFilter !== 'all' || searchQuery) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#fca5a5'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚠️ Connection Alert</div>
              <div>{error}</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tip: Start the backend using <code>uvicorn main:app --reload</code> inside the <code>backend/</code> folder.
              </div>
            </div>
          )}

          {/* Task List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading tasks from database...
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <div className="empty-title">No tasks found</div>
              <div className="empty-desc">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No tasks matched your current search and filter criteria.'
                  : 'Your academic task queue is clean. Add a task or generate sample student tasks to get started!'}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button onClick={openCreateModal} className="btn btn-primary">
                  ＋ Create First Task
                </button>
                <button onClick={handleAddSampleTasks} className="btn btn-secondary">
                  ✨ Seed Sample Tasks
                </button>
              </div>
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => {
                const overdue = isOverdue(task);
                return (
                  <div
                    key={task.id}
                    className={`task-card ${task.completed ? 'is-completed' : ''}`}
                  >
                    <div className="task-left">
                      <input
                        type="checkbox"
                        className="task-checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleComplete(task)}
                        title={task.completed ? 'Mark as pending' : 'Mark as completed'}
                      />
                      <div className="task-info">
                        <div className="task-title">{task.title}</div>
                        {task.description && (
                          <div className="task-desc">{task.description}</div>
                        )}
                        <div className="task-meta">
                          <span className={`badge badge-${task.priority}`}>
                            ● {task.priority}
                          </span>

                          {task.due_date && (
                            <span className="badge badge-date">
                              📅 Due: {formatDateDisplay(task.due_date)}
                            </span>
                          )}

                          {overdue && (
                            <span className="badge badge-overdue">
                              ⚠️ Overdue
                            </span>
                          )}

                          {task.completed && (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                              ✓ Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="task-actions">
                      <button
                        className="action-icon-btn"
                        title="Edit Task"
                        onClick={() => openEditModal(task)}
                      >
                        ✏️
                      </button>
                      <button
                        className="action-icon-btn delete-btn"
                        title="Delete Task"
                        onClick={() => setDeletingTask(task)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit Task Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingTask ? 'Edit Task' : 'Add New Academic Task'}</h2>
              <button
                className="action-icon-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTask}>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. CS201 Assignment 3, Calculus Midterm Review"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Study Notes</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="Add details, textbook chapters, or deliverables..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-control"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTask && (
        <div className="modal-overlay" onClick={() => setDeletingTask(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#ef4444' }}>Confirm Deletion</h2>
              <button className="action-icon-btn" onClick={() => setDeletingTask(null)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Are you sure you want to permanently delete this task?
            </p>
            <div style={{
              background: 'var(--bg-input)',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem',
              fontWeight: 600
            }}>
              "{deletingTask.title}"
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingTask(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backend Health Check Modal */}
      {isHealthModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHealthModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Backend Connection Diagnostic</h2>
              <button className="action-icon-btn" onClick={() => setIsHealthModalOpen(false)}>✕</button>
            </div>

            {healthChecking ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Pinging {apiBase}/api/health ...
              </div>
            ) : healthStatus ? (
              <div>
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: healthStatus.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${healthStatus.ok ? '#10b981' : '#ef4444'}`,
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: 700, color: healthStatus.ok ? '#10b981' : '#ef4444' }}>
                    {healthStatus.ok ? '🟢 Backend is Healthy & Responding' : '🔴 Cannot Reach Backend'}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Latency: <strong>{healthStatus.latency} ms</strong>
                  </div>
                </div>

                {healthStatus.ok && (
                  <pre style={{
                    background: 'var(--bg-input)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    overflowX: 'auto',
                    border: '1px solid var(--border-color)'
                  }}>
                    {JSON.stringify(healthStatus.data, null, 2)}
                  </pre>
                )}

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">Backend API URL:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={apiBase}
                    onChange={(e) => {
                      setApiBase(e.target.value);
                      localStorage.setItem('task_api_base', e.target.value);
                    }}
                  />
                  <small style={{ color: 'var(--text-dim)', display: 'block', marginTop: '0.35rem' }}>
                    Standard FastAPI address is <code>http://127.0.0.1:8000</code>.
                  </small>
                </div>
              </div>
            ) : null}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsHealthModalOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={checkBackendHealth}>
                Re-test Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-msg">
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
