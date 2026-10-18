import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = path.resolve(__dirname, 'student_tasks.db');
const db = new Database(dbPath);

// Enable WAL mode for fast concurrent reads/writes
db.pragma('journal_mode = WAL');

// Ensure tasks table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const app = express();
app.use(express.json());

// Enable CORS for all incoming origins and methods
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Helper: format task record for JSON response
interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  completed: number;
  created_at: string;
  updated_at: string;
}

function formatTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    due_date: row.due_date || '',
    priority: row.priority || 'medium',
    completed: Boolean(row.completed),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// 1. Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT count(*) as count FROM tasks').get() as { count: number };
    res.json({
      status: 'ok',
      message: 'AI Student Task Manager API is running smoothly',
      database: 'connected',
      engine: 'SQLite3',
      total_records: row.count,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: 'error', error: errorMsg });
  }
});

// 2. Dashboard Statistics endpoint
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalRow = db.prepare('SELECT count(*) as count FROM tasks').get() as { count: number };
    const completedRow = db.prepare('SELECT count(*) as count FROM tasks WHERE completed = 1').get() as { count: number };
    const pendingRow = db.prepare('SELECT count(*) as count FROM tasks WHERE completed = 0').get() as { count: number };
    
    // Overdue: pending and due_date is non-empty and before today's date
    const overdueRow = db.prepare(`
      SELECT count(*) as count FROM tasks 
      WHERE completed = 0 
        AND due_date IS NOT NULL 
        AND due_date != '' 
        AND date(due_date) < date(?)
    `).get(today) as { count: number };

    res.json({
      total: totalRow.count,
      completed: completedRow.count,
      pending: pendingRow.count,
      overdue: overdueRow.count,
      updated_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to retrieve stats', details: errorMsg });
  }
});

// 3. List all tasks (with optional filtering and search)
app.get('/api/tasks', (req: Request, res: Response) => {
  try {
    const { status, priority, search } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];

    if (search && typeof search === 'string' && search.trim() !== '') {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (priority && typeof priority === 'string' && priority !== 'all') {
      query += ' AND priority = ?';
      params.push(priority.toLowerCase());
    }

    if (status && typeof status === 'string' && status !== 'all') {
      if (status === 'completed') {
        query += ' AND completed = 1';
      } else if (status === 'pending') {
        query += ' AND completed = 0';
      } else if (status === 'overdue') {
        query += ' AND completed = 0 AND due_date IS NOT NULL AND due_date != "" AND date(due_date) < date(?)';
        params.push(today);
      }
    }

    query += " ORDER BY completed ASC, CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END, due_date ASC, id DESC";


    const rows = db.prepare(query).all(...params) as TaskRow[];
    res.json(rows.map(formatTask));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to fetch tasks', details: errorMsg });
  }
});

// 4. Get one task by ID
app.get('/api/tasks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!row) {
      res.status(404).json({ error: `Task with ID ${id} not found` });
      return;
    }
    res.json(formatTask(row));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to fetch task', details: errorMsg });
  }
});

// 5. Create a new task
app.post('/api/tasks', (req: Request, res: Response) => {
  try {
    const { title, description, due_date, priority } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(422).json({ error: 'Task title is required' });
      return;
    }

    const validPriority = ['high', 'medium', 'low'].includes((priority || '').toLowerCase())
      ? priority.toLowerCase()
      : 'medium';

    const cleanDueDate = due_date ? String(due_date).trim() : null;
    const cleanDesc = description ? String(description).trim() : '';

    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, due_date, priority, completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `);
    const info = stmt.run(title.trim(), cleanDesc, cleanDueDate, validPriority);

    const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRow;
    res.status(201).json(formatTask(created));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to create task', details: errorMsg });
  }
});

// 6. Update a task
app.put('/api/tasks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!existing) {
      res.status(404).json({ error: `Task with ID ${id} not found` });
      return;
    }

    const { title, description, due_date, priority, completed } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(422).json({ error: 'Task title is required' });
      return;
    }

    const validPriority = ['high', 'medium', 'low'].includes((priority || '').toLowerCase())
      ? priority.toLowerCase()
      : existing.priority;

    const newCompleted = completed !== undefined ? (completed ? 1 : 0) : existing.completed;
    const cleanDueDate = due_date !== undefined ? (due_date ? String(due_date).trim() : null) : existing.due_date;
    const cleanDesc = description !== undefined ? (description ? String(description).trim() : '') : existing.description;

    const stmt = db.prepare(`
      UPDATE tasks 
      SET title = ?, description = ?, due_date = ?, priority = ?, completed = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(title.trim(), cleanDesc, cleanDueDate, validPriority, newCompleted, id);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow;
    res.json(formatTask(updated));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to update task', details: errorMsg });
  }
});

// 7. Toggle completion
app.patch('/api/tasks/:id/complete', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!existing) {
      res.status(404).json({ error: `Task with ID ${id} not found` });
      return;
    }

    let nextCompletedState: number;
    if (req.body && typeof req.body.completed === 'boolean') {
      nextCompletedState = req.body.completed ? 1 : 0;
    } else {
      nextCompletedState = existing.completed === 1 ? 0 : 1;
    }

    db.prepare("UPDATE tasks SET completed = ?, updated_at = datetime('now') WHERE id = ?").run(nextCompletedState, id);
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow;
    res.json(formatTask(updated));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to toggle task completion', details: errorMsg });
  }
});

// 8. Delete a task
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!existing) {
      res.status(404).json({ error: `Task with ID ${id} not found` });
      return;
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ message: 'Task deleted successfully', id: Number(id) });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to delete task', details: errorMsg });
  }
});

// 9. Seed 3 sample tasks endpoint
app.post('/api/seed', (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    
    // Tomorrow
    const d1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const due1 = `${d1.getFullYear()}-${pad(d1.getMonth() + 1)}-${pad(d1.getDate())}`;

    // In 4 days
    const d2 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    const due2 = `${d2.getFullYear()}-${pad(d2.getMonth() + 1)}-${pad(d2.getDate())}`;

    // Yesterday (overdue sample for demonstration)
    const d3 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const due3 = `${d3.getFullYear()}-${pad(d3.getMonth() + 1)}-${pad(d3.getDate())}`;

    const sampleTasks = [
      {
        title: 'Complete CS301 Operating Systems Milestone',
        description: 'Implement multi-threaded process scheduler in C and write unit tests.',
        due_date: due1,
        priority: 'high',
      },
      {
        title: 'Review Organic Chemistry Chapter 8 Reaction Mechanisms',
        description: 'Summarize SN1 vs SN2 reaction pathways and create flashcards.',
        due_date: due2,
        priority: 'medium',
      },
      {
        title: 'Submit Calculus II Problem Set #4',
        description: 'Solve integration by parts and trigonometric substitution exercises 1-25.',
        due_date: due3,
        priority: 'high',
      },
      {
        title: 'Literature Review: Modern Distributed Consensus',
        description: 'Read Paxos and Raft comparison papers for the senior seminar seminar.',
        due_date: '',
        priority: 'low',
      },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO tasks (title, description, due_date, priority, completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `);

    const inserted: TaskRow[] = [];
    const transaction = db.transaction(() => {
      for (const t of sampleTasks) {
        const info = insertStmt.run(t.title, t.description, t.due_date, t.priority);
        const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRow;
        inserted.push(row);
      }
    });

    transaction();

    res.json({
      message: 'Sample tasks added successfully',
      added_count: inserted.length,
      tasks: inserted.map(formatTask),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to seed sample tasks', details: errorMsg });
  }
});

// Vite middleware in dev or static serving in production
async function start() {
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${port}`);
  });
}

start().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
