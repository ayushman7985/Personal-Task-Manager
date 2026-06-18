import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, getApiConfigError } from './api';
import './App.css';

const FILTERS = [
  { value: 'all', label: 'All', icon: '◇' },
  { value: 'active', label: 'Active', icon: '⚡' },
  { value: 'completed', label: 'Done', icon: '✓' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First', icon: '↓' },
  { value: 'oldest', label: 'Oldest First', icon: '↑' },
  { value: 'due_date', label: 'Due Date', icon: '◷' },
  { value: 'priority', label: 'Priority', icon: '★' },
];

const PRIORITIES = [
  { value: 'low', label: 'LOW', sub: 'Relaxed pace', dotClass: 'low' },
  { value: 'medium', label: 'MEDIUM', sub: 'Balanced focus', dotClass: 'medium' },
  { value: 'high', label: 'HIGH', sub: 'Urgent priority', dotClass: 'high' },
];

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toInputDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isOverdue(task) {
  if (!task.due_date || task.completed) return false;
  return new Date(task.due_date) < new Date();
}

function PrioritySelector({ value, onChange }) {
  return (
    <div>
      <label className="field-label">Priority Level</label>
      <div className="priority-grid" role="radiogroup" aria-label="Priority level">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value === p.value}
            className={`priority-card${value === p.value ? ' selected' : ''}`}
            onClick={() => onChange(p.value)}
          >
            {value === p.value && (
              <>
                <span className="corner tl" />
                <span className="corner tr" />
                <span className="corner bl" />
                <span className="corner br" />
              </>
            )}
            <span className={`priority-dot ${p.dotClass}`} />
            <span className="priority-name">{p.label}</span>
            <span className="priority-sub">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeleteModal({ task, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Delete Task</h3>
        <p>
          Permanently remove &ldquo;{task.title}&rdquo;? This cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskForm({ onSubmit, loading }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
    });
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
  };

  return (
    <form className="panel-card task-form" onSubmit={handleSubmit}>
      <h2 className="section-label">
        <span>+</span> New Task
      </h2>

      <input
        className="panel-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title *"
        required
      />

      <textarea
        className="panel-textarea"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
      />

      <PrioritySelector value={priority} onChange={setPriority} />

      <div>
        <label className="field-label" htmlFor="dueDate">
          Due Date
        </label>
        <input
          id="dueDate"
          className="panel-input"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      <button className="btn-accent" type="submit" disabled={loading || !title.trim()}>
        {loading ? 'Adding...' : 'Add Task'}
      </button>
    </form>
  );
}

function SortableTaskItem({ task, onToggle, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editDueDate, setEditDueDate] = useState(toInputDateTime(task.due_date));
  const [editPriority, setEditPriority] = useState(task.priority || 'medium');

  const overdue = isOverdue(task);
  const priority = task.priority || 'medium';

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    onEdit(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
      priority: editPriority,
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditDueDate(toInputDateTime(task.due_date));
    setEditPriority(task.priority || 'medium');
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-item${task.completed ? ' completed' : ''}${overdue ? ' overdue' : ''}`}
    >
      <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        ⠿
      </span>
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
      />
      <div className="task-body">
        {editing ? (
          <div className="edit-form">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              required
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
            />
            <input
              type="datetime-local"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
            />
            <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <div className="edit-actions">
              <button className="btn btn-primary" onClick={saveEdit} disabled={!editTitle.trim()}>
                Save
              </button>
              <button className="btn btn-secondary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="task-title-row">
              <span className="task-title">{task.title}</span>
              <span className={`priority-pill ${priority}`}>{priority}</span>
            </div>
            {task.description && (
              <div className="task-description">{task.description}</div>
            )}
            <div className="task-meta">
              {task.due_date && (
                <span className={`due-badge${overdue ? ' overdue' : ''}`}>
                  {overdue ? '⚠ Overdue: ' : 'Due: '}
                  {formatDate(task.due_date)}
                </span>
              )}
              <span>Created {formatDate(task.created_at)}</span>
            </div>
          </>
        )}
      </div>
      {!editing && (
        <div className="task-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(true)} title="Edit">
            ✎
          </button>
          <button className="btn btn-ghost" onClick={() => onDelete(task)} title="Delete">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState({ active: 0, completed: 0 });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(() => getApiConfigError());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalTasks = counts.active + counts.completed;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [taskData, countData] = await Promise.all([
        api.getTasks(filter, search, sort),
        api.getCounts(),
      ]);
      setTasks(taskData);
      setCounts(countData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search, sort]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(loadData, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  const handleCreate = async (data) => {
    setActionLoading(true);
    try {
      await api.createTask(data);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.toggleTask(id);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = async (id, data) => {
    try {
      await api.updateTask(id, data);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteTask(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    setTasks(reordered);
    setSort('manual');

    try {
      await api.reorderTasks(reordered.map((t) => t.id));
    } catch (err) {
      setError(err.message);
      await loadData();
    }
  };

  return (
    <div className="app">
      <header className="header-card">
        <div className="header-badges">
          <span className="header-badge cyan">+ Tasks</span>
          <span className="header-badge purple">{totalTasks} Total</span>
        </div>
        <h1 className="header-title">TASK MANAGER</h1>
        <p className="header-subtitle">
          Organize your personal to-do list
        </p>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <TaskForm onSubmit={handleCreate} loading={actionLoading} />

      <div className="panel-card queue-card">
        <div className="queue-toolbar">
          <div className="queue-toolbar-row">
            <div className="status-pills">
              <span className="status-pill active-pill">
                <span className="pill-icon">⚡</span>
                {counts.active} active
              </span>
              <span className="status-pill done-pill">
                <span className="pill-icon">✓</span>
                {counts.completed} done
              </span>
            </div>
            <div className="filter-tabs" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  className={`filter-tab${filter === f.value ? ' active' : ''}`}
                  onClick={() => setFilter(f.value)}
                  aria-selected={filter === f.value}
                >
                  <span className="tab-icon">{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="search-wrapper">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              className="search-input"
              type="search"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="sort-section">
            <span className="sort-label">Sort By</span>
            <div className="sort-tabs" role="group" aria-label="Sort tasks">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`sort-tab${sort === s.value ? ' active' : ''}`}
                  onClick={() => setSort(s.value)}
                  aria-pressed={sort === s.value}
                >
                  <span className="tab-icon">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="queue-divider" />

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon-wrap">
              <span className="empty-state-diamond">◇</span>
            </div>
            <p className="empty-state-text">
              {search || filter !== 'all'
                ? 'No tasks match your search or filter.'
                : 'No tasks yet. Add your first task above.'}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="task-list">
                {tasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          task={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
