from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, inspect, text
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Task
from .schemas import TaskCounts, TaskCreate, TaskReorder, TaskResponse, TaskUpdate

Base.metadata.create_all(bind=engine)


def _migrate_db():
    inspector = inspect(engine)
    if "tasks" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("tasks")}
    if "priority" not in columns:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "ALTER TABLE tasks ADD COLUMN priority VARCHAR(10) "
                    "NOT NULL DEFAULT 'medium'"
                )
            )
            conn.commit()


_migrate_db()

app = FastAPI(title="Task Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _normalize_due_date(due_date: Optional[datetime]) -> Optional[datetime]:
    if due_date is None:
        return None
    if due_date.tzinfo is not None:
        return due_date.astimezone(timezone.utc).replace(tzinfo=None)
    return due_date


@app.get("/api/tasks", response_model=list[TaskResponse])
def list_tasks(
    status: Literal["all", "active", "completed"] = Query("all"),
    search: Optional[str] = Query(None),
    sort: Literal["newest", "oldest", "due_date", "priority", "manual"] = Query("newest"),
    db: Session = Depends(get_db),
):
    query = db.query(Task)

    if status == "active":
        query = query.filter(Task.completed.is_(False))
    elif status == "completed":
        query = query.filter(Task.completed.is_(True))

    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    if sort == "oldest":
        query = query.order_by(Task.created_at.asc())
    elif sort == "due_date":
        query = query.order_by(Task.due_date.is_(None), Task.due_date.asc())
    elif sort == "priority":
        priority_order = case(
            (Task.priority == "high", 0),
            (Task.priority == "medium", 1),
            (Task.priority == "low", 2),
            else_=1,
        )
        query = query.order_by(priority_order, Task.created_at.desc())
    elif sort == "manual":
        query = query.order_by(Task.position.asc(), Task.created_at.desc())
    else:
        query = query.order_by(Task.created_at.desc())

    return query.all()


@app.get("/api/tasks/counts", response_model=TaskCounts)
def task_counts(db: Session = Depends(get_db)):
    active = db.query(func.count(Task.id)).filter(Task.completed.is_(False)).scalar() or 0
    completed = db.query(func.count(Task.id)).filter(Task.completed.is_(True)).scalar() or 0
    return TaskCounts(active=active, completed=completed)


@app.post("/api/tasks", response_model=TaskResponse, status_code=201)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    min_position = db.query(func.min(Task.position)).scalar()
    new_position = (min_position - 1) if min_position is not None else 0

    task = Task(
        title=task_in.title.strip(),
        description=task_in.description,
        due_date=_normalize_due_date(task_in.due_date),
        priority=task_in.priority,
        position=new_position,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.put("/api/tasks/reorder", response_model=list[TaskResponse])
def reorder_tasks(reorder: TaskReorder, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.id.in_(reorder.task_ids)).all()
    if len(tasks) != len(reorder.task_ids):
        raise HTTPException(status_code=400, detail="One or more task IDs are invalid")

    task_map = {t.id: t for t in tasks}
    for index, task_id in enumerate(reorder.task_ids):
        task_map[task_id].position = index

    db.commit()
    return (
        db.query(Task)
        .order_by(Task.position.asc(), Task.created_at.desc())
        .all()
    )


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task_in.title is not None:
        task.title = task_in.title.strip()
    if task_in.description is not None:
        task.description = task_in.description
    if "due_date" in task_in.model_fields_set:
        task.due_date = _normalize_due_date(task_in.due_date)
    if task_in.priority is not None:
        task.priority = task_in.priority

    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}/toggle", response_model=TaskResponse)
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.completed = not task.completed
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
