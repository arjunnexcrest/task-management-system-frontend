import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Project, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([projectsApi.listProjects(), tasksApi.listTasks()])
      .then(([p, t]) => {
        setProjects(p)
        setTasks(t)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">TMS · Project, Task & Assignment Workspace</p>
          <h1>Task Management System (UUID Schema)</h1>
          <p>
            Connected to PostgreSQL (`tms_db`) with 20 Project, Task, Subtask, and Assignment tables.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/projects/new" className="btn">
            + New Project
          </Link>
          <Link to="/tasks/new" className="btn btn-primary">
            + New Task / Subtask
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Projects</div>
          <div className="stat-value">{loading ? '...' : projects.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tasks & Subtasks</div>
          <div className="stat-value">{loading ? '...' : tasks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Subtasks (`parent_task_id`)</div>
          <div className="stat-value">
            {loading ? '...' : tasks.filter((t) => t.is_subtask).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Assignments</div>
          <div className="stat-value">
            {loading
              ? '...'
              : tasks.reduce((acc, t) => acc + t.active_assignments.length, 0)}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h3>Projects Overview</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Manage multi-company projects, phases, milestones, dependencies, and budgets.
          </p>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <Link to="/projects" className="btn btn-primary">
              Open Projects ({projects.length})
            </Link>
          </div>
        </div>

        <div className="card">
          <h3>Tasks, Subtasks & Assignments</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Create tasks and subtasks, assign users or teams, track reassignment history, and manage checklists.
          </p>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <Link to="/tasks" className="btn btn-primary">
              Open Tasks ({tasks.length})
            </Link>
            <Link to="/kanban" className="btn">
              Kanban Board
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
