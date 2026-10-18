# AI Student Task Manager 🎓

A complete, production-grade full-stack web application designed for students to organize coursework, monitor deadlines, and track academic tasks with real-time statistics and persistent SQLite storage.

---

## 📁 Project Structure

```text
student-task-manager/
├── backend/
│   ├── main.py              # FastAPI REST API endpoints, CORS, & error handling
│   ├── database.py          # SQLite database connection, schema creation, & CRUD operations
│   └── requirements.txt     # Python backend dependencies (FastAPI, Uvicorn, Pydantic)
├── frontend/
│   ├── index.html           # HTML5 entry with modern Google typography
│   ├── package.json         # React 18, Vite, & Lucide React dependencies
│   └── src/
│       ├── main.jsx         # React application bootstrap
│       ├── App.jsx          # Interactive dashboard, modals, filters, & Fetch API client
│       └── App.css          # Responsive styling, priority badges, & dark-mode theme
└── README.md                # Setup documentation, commands, & API specifications
```

---

## ⚡ Quick Start: Windows Guide (Under 10 Minutes)

Follow these exact steps in your terminal (VS Code Terminal, PowerShell, or Command Prompt).

### Step 1: Start the Python FastAPI Backend

Open a terminal in the `student-task-manager/backend/` directory:

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create Python virtual environment
python -m venv venv

# 3. Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1
# (Note: If using Command Prompt (cmd.exe), run: venv\Scripts\activate.bat)
# (If PowerShell displays an Execution Policy error, run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Start the FastAPI server with auto-reload
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

> The backend automatically creates `student_tasks.db` on launch and will be live at:
> - **API Base URL**: `http://127.0.0.1:8000`
> - **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
> - **Alternative Redoc Docs**: `http://127.0.0.1:8000/redoc`

---

### Step 2: Start the React Frontend

Open a **second** terminal window in the `student-task-manager/frontend/` directory:

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Vite development server
npm run dev
```

> Vite will start your frontend at `http://localhost:5173` (or `http://localhost:3000`).
> Open this link in your browser to interact with the live dashboard!

---

## 🧪 Testing Every API Endpoint with Windows Commands

Run these commands in PowerShell or Command Prompt while the backend is running to test each REST API endpoint.

### 1. Test Backend Health Check
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get | ConvertTo-Json
```
*Expected response: HTTP 200 with status "ok", database "connected", engine "SQLite3".*

---

### 2. Add 3+ Sample Student Tasks via API
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/seed" -Method Post | ConvertTo-Json
```
*Expected response: HTTP 201 with seeded coursework tasks.*

---

### 3. Create a New Academic Task
```powershell
$body = @{
    title = "Physics 202 Lab Report - Wave Optics"
    description = "Analyze spectrometer diffraction grating data and calculate wavelengths."
    due_date = "2026-10-25"
    priority = "high"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json
```
*Expected response: HTTP 201 with new task record including generated `id`.*

---

### 4. List All Tasks
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks" -Method Get | ConvertTo-Json
```

---

### 5. Filter Tasks by Priority and Search
```powershell
# Search tasks with priority 'high'
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks?priority=high" -Method Get | ConvertTo-Json

# Search tasks by keyword
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks?search=Physics" -Method Get | ConvertTo-Json
```

---

### 6. Get a Single Task by ID (e.g., ID 1)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks/1" -Method Get | ConvertTo-Json
```

---

### 7. Toggle Task Completion (Pending ⟷ Completed)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks/1/complete" -Method Patch -Body "{}" -ContentType "application/json" | ConvertTo-Json
```
*Expected response: HTTP 200 with `completed: true`.*

---

### 8. Update an Existing Task
```powershell
$updateBody = @{
    title = "Physics 202 Lab Report - REVISED"
    description = "Added error propagation formulas and graphs."
    due_date = "2026-10-28"
    priority = "medium"
    completed = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks/1" -Method Put -Body $updateBody -ContentType "application/json" | ConvertTo-Json
```

---

### 9. Retrieve Dashboard Statistics
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/stats" -Method Get | ConvertTo-Json
```
*Expected response:*
```json
{
  "total": 4,
  "completed": 0,
  "pending": 4,
  "overdue": 1,
  "updated_at": "..."
}
```

---

### 10. Delete a Task (e.g., ID 1)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/tasks/1" -Method Delete | ConvertTo-Json
```
*Expected response: HTTP 200 with confirmation message.*

---

## 📚 REST API Specification Reference

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Diagnostic connectivity & SQLite status | 200 |
| `GET` | `/api/stats` | Dashboard statistics (total, pending, completed, overdue) | 200 |
| `GET` | `/api/tasks` | List tasks (supports `?status=`, `?priority=`, `?search=`) | 200 |
| `GET` | `/api/tasks/{id}` | Get single task by ID | 200 / 404 |
| `POST` | `/api/tasks` | Create task (`title`, `description`, `due_date`, `priority`) | 201 / 422 |
| `PUT` | `/api/tasks/{id}` | Update task details and status | 200 / 404 / 422 |
| `PATCH` | `/api/tasks/{id}/complete` | Toggle completion state | 200 / 404 |
| `DELETE` | `/api/tasks/{id}` | Delete task permanently | 200 / 404 |
| `POST` | `/api/seed` | Seed realistic student coursework tasks | 201 |

---

## 💡 Troubleshooting & FAQ

1. **PowerShell Script Execution Policy Warning:**
   If running `.\venv\Scripts\Activate.ps1` produces a script execution restricted warning:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
2. **CORS Errors:**
   FastAPI has CORS enabled for all origins by default in `main.py` via `CORSMiddleware`. If accessing from a custom port or remote host, it is already allowed.
3. **Database File Location:**
   The SQLite file is automatically maintained at `backend/student_tasks.db`. You can inspect it with the VS Code SQLite extension or DB Browser for SQLite.
