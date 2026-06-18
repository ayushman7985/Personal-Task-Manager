# Task Manager

A full-stack personal task manager with a cyberpunk-inspired UI. Create, organize, and track tasks with priorities, due dates, filtering, sorting, and drag-and-drop reordering. Data is persisted in SQLite and survives server restarts.

No authentication is required — the app is designed for a single user.

---

## Features

### Task management
- **Create** tasks with a required title, optional description, due date, and priority (`low` / `medium` / `high`)
- **View** all tasks in a sortable, filterable list
- **Edit** title, description, due date, and priority inline
- **Toggle** completion status
- **Delete** tasks with a confirmation prompt
- **Drag-and-drop** to manually reorder tasks

### Organization
- **Filter** by status: All, Active, Done
- **Search** tasks by title
- **Sort** by: Newest First, Oldest First, Due Date, Priority, or Manual (after drag-and-drop)
- **Status counters** for active and completed tasks

### UI / UX
- Dark neural/cyberpunk theme with cyan and purple accents
- Overdue tasks highlighted when due date has passed and task is incomplete
- Empty state when no tasks match the current view
- Responsive layout for smaller screens

---

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Python, FastAPI, SQLAlchemy, Pydantic, Uvicorn |
| Frontend | React 18, Vite, @dnd-kit                        |
| Database | SQLite (`tasks.db`)                             |

---

## Project Structure

```
TM/
├── README.md
├── requirements.txt          # Python dependencies
├── backend/
│   ├── main.py               # FastAPI app & API routes
│   ├── database.py           # SQLite connection & session
│   ├── models.py             # SQLAlchemy Task model
│   ├── schemas.py            # Pydantic request/response schemas
│   └── tasks.db              # SQLite database (created on first run)
└── frontend/
    ├── package.json
    ├── vite.config.js        # Dev server & API proxy
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx           # Main UI components
        ├── App.css
        ├── api.js            # API client
        └── index.css         # Global styles & theme
```

---

## Prerequisites

- **Python** 3.10+ (3.11+ recommended)
- **Node.js** 18+ and npm
- **pip** for Python package management

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd TM
```

### 2. Backend setup

Create and activate a virtual environment (recommended):

```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API server from the **project root**:

```bash
uvicorn backend.main:app --reload --port 8000
```

For production (e.g. Render):

```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

The API will be available at **http://localhost:8000**.

Interactive API docs:
- Swagger UI: **http://localhost:8000/docs**
- ReDoc: **http://localhost:8000/redoc**

### 3. Frontend setup

In a **second terminal**, from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

The Vite dev server proxies `/api` requests to the backend at `http://localhost:8000`.

---

## Production Build

Build the frontend for production:

```bash
cd frontend
npm run build
```

Output is written to `frontend/dist/`. Serve those static files with any web server and point API requests to your deployed backend. Update CORS origins in `backend/main.py` if the frontend is hosted on a different domain.

---

## Deploy to Vercel (Frontend)

The React frontend deploys to **Vercel**. The FastAPI backend should be deployed separately (e.g. **Render**).

### Vercel project settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework Preset** | `Vite` (not FastAPI) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Environment variables (Vercel)

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://your-app.onrender.com/api` |

### Environment variables (Render — backend)

| Variable | Example |
|----------|---------|
| `FRONTEND_URL` | `https://your-app.vercel.app` |

Set `FRONTEND_URL` on Render so the API accepts requests from your Vercel domain (CORS).

### Fix for build error 126

If you see `Command "npm run build" exited with 126`:

1. Set **Root Directory** to `frontend` in Vercel (not the repo root).
2. Choose **Vite** as the framework — do not use the FastAPI preset for the frontend project.
3. Do **not** commit `node_modules/` — ensure `.gitignore` is in the repo and push again.
4. The build script uses `npx vite build` so Vercel installs the correct Linux binary during deploy.

---

## API Reference

Base URL: `http://localhost:8000/api`

### Tasks

| Method   | Endpoint                  | Description                          |
|----------|---------------------------|--------------------------------------|
| `GET`    | `/tasks`                  | List tasks (supports query params)   |
| `POST`   | `/tasks`                  | Create a new task                    |
| `GET`    | `/tasks/{id}`             | Get a single task                    |
| `PUT`    | `/tasks/{id}`             | Update a task                      |
| `PATCH`  | `/tasks/{id}/toggle`      | Toggle completed status              |
| `DELETE` | `/tasks/{id}`             | Delete a task                        |
| `PUT`    | `/tasks/reorder`          | Reorder tasks by ID list             |
| `GET`    | `/tasks/counts`           | Get active and completed counts      |

### Query parameters — `GET /tasks`

| Parameter | Values                                              | Default  |
|-----------|-----------------------------------------------------|----------|
| `status`  | `all`, `active`, `completed`                        | `all`    |
| `search`  | Any string (case-insensitive title match)           | —        |
| `sort`    | `newest`, `oldest`, `due_date`, `priority`, `manual`| `newest` |

### Example — create a task

```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ship feature",
    "description": "Finish and deploy the task manager",
    "due_date": "2026-06-20T17:00:00",
    "priority": "high"
  }'
```

### Example — reorder tasks

```bash
curl -X PUT http://localhost:8000/api/tasks/reorder \
  -H "Content-Type: application/json" \
  -d '{"task_ids": [3, 1, 2]}'
```

---

## Database

SQLite database file: `backend/tasks.db`

Created automatically on first server start. Schema:

| Column       | Type     | Description                              |
|--------------|----------|------------------------------------------|
| `id`         | Integer  | Primary key                              |
| `title`      | String   | Required task title                      |
| `description`| Text     | Optional details                         |
| `due_date`   | DateTime | Optional due date                        |
| `priority`   | String   | `low`, `medium`, or `high`               |
| `completed`  | Boolean  | Completion status                        |
| `position`   | Integer  | Manual sort order (drag-and-drop)        |
| `created_at` | DateTime | Creation timestamp (UTC)                 |

To reset all data, stop the server and delete `backend/tasks.db`. A fresh database will be created on the next start.

---

## Development Notes

- Run `uvicorn backend.main:app` from the **project root** (not from inside `backend/`).
- SQLite data is stored at `backend/tasks.db`.
- CORS is configured for `http://localhost:5173` and `http://127.0.0.1:5173`. Add additional origins in `backend/main.py` as needed.
- The backend includes a lightweight migration that adds the `priority` column to existing databases.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Frontend can't reach API | Ensure the backend is running on port 8000 |
| `pip install` fails on Pydantic | Use Python 3.10–3.13, or install the latest package versions |
| Empty task list after restart | Confirm `tasks.db` exists in `backend/` and the server was started from that directory |
| CORS errors in production | Update `allow_origins` in `backend/main.py` |

---

## License

This project is open source. Add your preferred license here.
