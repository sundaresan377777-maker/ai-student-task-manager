"""
AI Student Task Manager - FastAPI Backend
Provides RESTful endpoints for task CRUD, status toggling, and dashboard statistics.
"""

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

import database

# Initialize FastAPI application
app = FastAPI(
    title="AI Student Task Manager API",
    description="Full-stack student task management REST API with SQLite database persistence.",
    version="1.0.0"
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from Vite (http://localhost:5173, http://127.0.0.1:5173, http://localhost:3000, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Schemas
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Task title is required")
    description: Optional[str] = Field(default="", description="Detailed description or notes")
    due_date: Optional[str] = Field(default="", description="ISO formatted date string YYYY-MM-DD")
    priority: str = Field(default="medium", description="Priority level: high, medium, or low")


class TaskUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Updated task title")
    description: Optional[str] = Field(default="", description="Updated notes")
    due_date: Optional[str] = Field(default="", description="Updated due date YYYY-MM-DD")
    priority: str = Field(default="medium", description="Priority level: high, medium, or low")
    completed: Optional[bool] = Field(default=None, description="Task completion status")


class TaskCompleteToggle(BaseModel):
    completed: Optional[bool] = Field(default=None, description="Optional target completion state")


# Startup event: Ensure SQLite tables exist automatically
@app.on_event("startup")
def on_startup():
    """Ensure database schema is created on application startup."""
    database.init_db()


# 1. Health check endpoint
@app.get("/api/health", tags=["System"])
def check_health() -> Dict[str, Any]:
    """Verify backend connectivity and database health."""
    try:
        stats = database.get_stats()
        return {
            "status": "ok",
            "message": "AI Student Task Manager backend is running smoothly",
            "database": "connected",
            "engine": "SQLite3",
            "total_tasks_stored": stats["total"],
            "server_time": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connectivity check failed: {str(e)}"
        )


# 2. Dashboard statistics endpoint
@app.get("/api/stats", tags=["Dashboard"])
def get_dashboard_stats() -> Dict[str, Any]:
    """Return dashboard statistics: total, pending, completed, overdue."""
    try:
        return database.get_stats()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}"
        )


# 3. List all tasks (with filtering & search)
@app.get("/api/tasks", tags=["Tasks"])
def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by: all, pending, completed, overdue"),
    priority_filter: Optional[str] = Query(None, alias="priority", description="Filter by: all, high, medium, low"),
    search: Optional[str] = Query(None, description="Search term for title or description")
) -> List[Dict[str, Any]]:
    """Retrieve all student tasks matching query parameters."""
    return database.get_all_tasks(status=status_filter, priority=priority_filter, search=search)


# 4. Get a single task by ID
@app.get("/api/tasks/{task_id}", tags=["Tasks"])
def get_task(task_id: int) -> Dict[str, Any]:
    """Retrieve a single task by its unique ID."""
    task = database.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found."
        )
    return task


# 5. Create a new task
@app.post("/api/tasks", status_code=status.HTTP_201_CREATED, tags=["Tasks"])
def create_task_endpoint(payload: TaskCreate) -> Dict[str, Any]:
    """Create a new academic task."""
    priority = payload.priority.lower()
    if priority not in ["high", "medium", "low"]:
        priority = "medium"

    created = database.create_task(
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=priority
    )
    return created


# 6. Update an existing task
@app.put("/api/tasks/{task_id}", tags=["Tasks"])
def update_task_endpoint(task_id: int, payload: TaskUpdate) -> Dict[str, Any]:
    """Update title, description, due date, priority, or completion state."""
    updated = database.update_task(
        task_id=task_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        completed=payload.completed
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cannot update: Task with ID {task_id} does not exist."
        )
    return updated


# 7. Toggle or set task completion
@app.patch("/api/tasks/{task_id}/complete", tags=["Tasks"])
def toggle_completion_endpoint(task_id: int, payload: Optional[TaskCompleteToggle] = None) -> Dict[str, Any]:
    """Toggle a task's status between pending and completed."""
    target_completed = payload.completed if payload else None
    updated = database.toggle_task_completion(task_id=task_id, completed=target_completed)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cannot toggle: Task with ID {task_id} not found."
        )
    return updated


# 8. Delete a task
@app.delete("/api/tasks/{task_id}", tags=["Tasks"])
def delete_task_endpoint(task_id: int) -> Dict[str, Any]:
    """Permanently delete a task from the SQLite database."""
    success = database.delete_task(task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cannot delete: Task with ID {task_id} does not exist."
        )
    return {"message": "Task deleted successfully", "id": task_id}


# 9. Seed sample student tasks
@app.post("/api/seed", status_code=status.HTTP_201_CREATED, tags=["Utilities"])
def seed_tasks() -> Dict[str, Any]:
    """Populate database with sample student coursework tasks."""
    seeded = database.seed_sample_tasks()
    return {
        "message": f"Successfully created {len(seeded)} sample student tasks",
        "tasks": seeded
    }


if __name__ == "__main__":
    import uvicorn
    # When run directly, start server on 127.0.0.1:8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
