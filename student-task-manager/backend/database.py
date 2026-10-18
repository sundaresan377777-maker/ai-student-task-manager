"""
Database module for AI Student Task Manager
Provides SQLite connection management, schema initialization, and CRUD operations.
"""

import sqlite3
import os
from datetime import datetime, date
from typing import List, Optional, Dict, Any

DB_FILE = os.path.join(os.path.dirname(__file__), "student_tasks.db")


def get_db_connection() -> sqlite3.Connection:
    """Creates a database connection with dictionary-like row access."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    """Initializes the database schema if tables do not exist."""
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
        conn.commit()


def dict_from_row(row: sqlite3.Row) -> Dict[str, Any]:
    """Helper to convert a sqlite3.Row to standard dictionary."""
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"] or "",
        "due_date": row["due_date"] or "",
        "priority": row["priority"] or "medium",
        "completed": bool(row["completed"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_all_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve all tasks with optional search, priority and status filtering."""
    today_str = date.today().isoformat()
    query = "SELECT * FROM tasks WHERE 1=1"
    params: List[Any] = []

    if search and search.strip():
        query += " AND (title LIKE ? OR description LIKE ?)"
        s = f"%{search.strip()}%"
        params.extend([s, s])

    if priority and priority.lower() != "all":
        query += " AND priority = ?"
        params.append(priority.lower())

    if status and status.lower() != "all":
        if status.lower() == "completed":
            query += " AND completed = 1"
        elif status.lower() == "pending":
            query += " AND completed = 0"
        elif status.lower() == "overdue":
            query += " AND completed = 0 AND due_date IS NOT NULL AND due_date != '' AND date(due_date) < date(?)"
            params.append(today_str)

    query += " ORDER BY completed ASC, CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END, due_date ASC, id DESC"

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [dict_from_row(r) for r in rows]


def get_task_by_id(task_id: int) -> Optional[Dict[str, Any]]:
    """Fetch a single task by ID."""
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        return dict_from_row(row) if row else None


def create_task(title: str, description: Optional[str] = "", due_date: Optional[str] = None, priority: str = "medium") -> Dict[str, Any]:
    """Insert a new task into the database."""
    valid_priority = priority.lower() if priority and priority.lower() in ["high", "medium", "low"] else "medium"
    now_iso = datetime.now().isoformat()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO tasks (title, description, due_date, priority, completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
            """,
            (title.strip(), description.strip() if description else "", due_date.strip() if due_date else "", valid_priority, now_iso, now_iso)
        )
        task_id = cursor.lastrowid
        conn.commit()

    return get_task_by_id(task_id)


def update_task(
    task_id: int,
    title: str,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    priority: Optional[str] = None,
    completed: Optional[bool] = None
) -> Optional[Dict[str, Any]]:
    """Update an existing task."""
    current = get_task_by_id(task_id)
    if not current:
        return None

    new_title = title.strip() if title else current["title"]
    new_desc = description.strip() if description is not None else current["description"]
    new_due = due_date.strip() if due_date is not None else current["due_date"]
    
    new_priority = current["priority"]
    if priority and priority.lower() in ["high", "medium", "low"]:
        new_priority = priority.lower()

    new_completed = completed if completed is not None else current["completed"]
    now_iso = datetime.now().isoformat()

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE tasks 
            SET title = ?, description = ?, due_date = ?, priority = ?, completed = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_title, new_desc, new_due, new_priority, 1 if new_completed else 0, now_iso, task_id)
        )
        conn.commit()

    return get_task_by_id(task_id)


def toggle_task_completion(task_id: int, completed: Optional[bool] = None) -> Optional[Dict[str, Any]]:
    """Toggle or set the completed status of a task."""
    current = get_task_by_id(task_id)
    if not current:
        return None

    new_status = not current["completed"] if completed is None else completed
    now_iso = datetime.now().isoformat()

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ?",
            (1 if new_status else 0, now_iso, task_id)
        )
        conn.commit()

    return get_task_by_id(task_id)


def delete_task(task_id: int) -> bool:
    """Delete a task by ID. Returns True if deleted, False if not found."""
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_stats() -> Dict[str, Any]:
    """Compute aggregate dashboard statistics."""
    today_str = date.today().isoformat()

    with get_db_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        completed = conn.execute("SELECT COUNT(*) FROM tasks WHERE completed = 1").fetchone()[0]
        pending = conn.execute("SELECT COUNT(*) FROM tasks WHERE completed = 0").fetchone()[0]
        overdue = conn.execute(
            """
            SELECT COUNT(*) FROM tasks 
            WHERE completed = 0 
              AND due_date IS NOT NULL 
              AND due_date != '' 
              AND date(due_date) < date(?)
            """,
            (today_str,)
        ).fetchone()[0]

    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "updated_at": datetime.now().isoformat()
    }


def seed_sample_tasks() -> List[Dict[str, Any]]:
    """Seeds at least 3 realistic academic sample tasks."""
    today = date.today()
    sample_items = [
        {
            "title": "Complete CS301 Operating Systems Milestone",
            "description": "Implement multi-threaded process scheduler in C and write unit tests.",
            "due_date": (today.replace(day=min(28, today.day + 1))).isoformat(),
            "priority": "high",
        },
        {
            "title": "Review Organic Chemistry Chapter 8 Reaction Mechanisms",
            "description": "Summarize SN1 vs SN2 reaction pathways and create flashcards.",
            "due_date": (today.replace(day=min(28, today.day + 4))).isoformat(),
            "priority": "medium",
        },
        {
            "title": "Submit Calculus II Problem Set #4",
            "description": "Solve integration by parts and trigonometric substitution exercises 1-25.",
            "due_date": (today.replace(day=max(1, today.day - 2))).isoformat(),
            "priority": "high",
        },
        {
            "title": "Literature Review: Distributed Consensus Protocols",
            "description": "Read Raft and Paxos papers for the senior seminar discussion.",
            "due_date": "",
            "priority": "low",
        }
    ]

    added = []
    for item in sample_items:
        task = create_task(
            title=item["title"],
            description=item["description"],
            due_date=item["due_date"],
            priority=item["priority"]
        )
        added.append(task)
    return added
