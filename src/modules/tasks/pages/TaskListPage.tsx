import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Task, tasksApi } from '@/modules/tasks/api'

function badgeClass(value: string) {
  const v = value.toLowerCase()
  if (v.includes('completed') || v.includes('approved')) return 'badge badge-active'
  if (v.includes('critical') || v.includes('blocked')) return 'badge badge-critical'
  if (v.includes('high') || v.includes('progress') || v.includes('assigned')) return 'badge badge-high'
  if (v.includes('medium') || v.includes('review')) return 'badge badge-medium'
  return 'badge'
}

export function Page() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  useEffect(() => {
    loadTasks()
  }, [statusFilter, priorityFilter])

  async function loadTasks() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (search.trim()) params.search = search.trim()
      const data = await tasksApi.listTasks(params)
      setTasks(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Module 7 · Task, Subtask & Assignment Management</p>
          <h1>Tasks, Subtasks & Assignments</h1>
          <p>Unified `tasks` hierarchy (`parent_task_id`) and multi-target `task_assignments`.</p>
        </div>
        <div className="btn-row">
          <Link to="/kanban" className="btn">
            Kanban Board
          </Link>
          <Link to="/tasks/new" className="btn btn-primary">
            + Create Task / Subtask
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Tasks & Subtasks</div>
          <div className="stat-value">{tasks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top-Level Tasks</div>
          <div className="stat-value">{tasks.filter((t) => !t.is_subtask).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Subtasks (`parent_task_id`)</div>
          <div className="stat-value">{tasks.filter((t) => t.is_subtask).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">
            {tasks.filter((t) => t.status === 'Completed').length}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search task title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadTasks()}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Backlog">Backlog</option>
            <option value="To Do">To Do</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            className="select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button className="btn" onClick={loadTasks}>
            Filter
          </button>
        </div>

        {loading ? (
          <p>Loading tasks from PostgreSQL...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title & Hierarchy</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Active Assignments (User / Team)</th>
                <th>Progress</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {t.is_subtask ? `↳ [Subtask] ${t.title}` : t.title}
                    </Link>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {t.phase_name ? `${t.phase_name} · ` : ''}
                      Method: {t.progress_method}
                      {t.subtasks_count > 0 ? ` · ${t.subtasks_count} subtasks` : ''}
                    </div>
                  </td>
                  <td>
                    <Link to={`/projects/${t.project}`}>{t.project_code}</Link>
                  </td>
                  <td>
                    <span className={badgeClass(t.status)}>{t.status}</span>
                  </td>
                  <td>
                    <span className={badgeClass(t.priority)}>{t.priority}</span>
                  </td>
                  <td>{t.task_owner_name || '—'}</td>
                  <td>
                    {t.active_assignments.length > 0 ? (
                      t.active_assignments.map((a) => (
                        <span
                          key={a.id}
                          className="badge"
                          style={{ marginRight: '0.25rem', marginBottom: '0.2rem' }}
                        >
                          {a.assignment_type === 'User' ? `👤 ${a.user_name}` : `👥 ${a.team_name}`}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ minWidth: '120px' }}>
                    <div style={{ fontSize: '0.78rem' }}>{Number(t.progress).toFixed(0)}%</div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Number(t.progress))}%` }}
                      />
                    </div>
                  </td>
                  <td>{t.due_date || '—'}</td>
                  <td>
                    <Link to={`/tasks/${t.id}`} className="btn btn-sm">
                      Details & Assign
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
