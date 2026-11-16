import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

const ALL_STATUSES: Task['status'][] = [
  'Backlog',
  'To Do',
  'Assigned',
  'In Progress',
  'On Hold',
  'Blocked',
  'In Review',
  'Changes Requested',
  'Approved',
  'Completed',
  'Cancelled',
]

function badgeClass(value: string) {
  const v = value.toLowerCase()
  if (v.includes('completed') || v.includes('approved')) return 'badge badge-active'
  if (v.includes('critical') || v.includes('blocked') || v.includes('changes'))
    return 'badge badge-critical'
  if (v.includes('high') || v.includes('progress') || v.includes('assigned'))
    return 'badge badge-high'
  if (v.includes('medium') || v.includes('review')) return 'badge badge-medium'
  return 'badge'
}

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // SRS §7.11 Search & Filters
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [subtaskFilter, setSubtaskFilter] = useState<'ALL' | 'TOP' | 'SUB'>('ALL')
  const [overdueOnly, setOverdueOnly] = useState(false)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), projectsApi.listProjects()])
      .then(([lkp, projs]) => {
        setLookup(lkp)
        setProjects(projs)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadTasks()
  }, [
    companyFilter,
    projectFilter,
    departmentFilter,
    teamFilter,
    assigneeFilter,
    statusFilter,
    priorityFilter,
    subtaskFilter,
    overdueOnly,
  ])

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (companyFilter) params.company = companyFilter
      if (projectFilter) params.project = projectFilter
      if (departmentFilter) params.department = departmentFilter
      if (teamFilter) params.team = teamFilter
      if (assigneeFilter) params.assignee = assigneeFilter
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (subtaskFilter === 'TOP') params.is_subtask = 'false'
      if (subtaskFilter === 'SUB') params.is_subtask = 'true'
      if (overdueOnly) params.overdue = 'true'
      if (search.trim()) params.search = search.trim()

      const data = await tasksApi.listTasks(params)
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteTask(task: Task) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${task.is_subtask ? 'subtask' : 'task'} "${task.title}"?`,
    )
    if (!confirmed) return
    setError(null)
    try {
      await tasksApi.deleteTask(task.id)
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 5 (§7.1–§7.11) · Task &amp; Subtask CRUD</p>
          <h1>Global Task List</h1>
          <p>
            Create, edit, search, filter, and manage tasks and nested subtasks across all authorized
            companies and projects.
          </p>
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
          <div className="stat-label">Total Tasks &amp; Subtasks</div>
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
          <div className="stat-label">Overdue / Critical</div>
          <div className="stat-value">
            {tasks.filter((t) => t.is_overdue || t.priority === 'Critical').length}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            className="input"
            style={{ minWidth: '210px' }}
            placeholder="Search task title, description, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadTasks()}
          />
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value)
              setProjectFilter('')
              setDepartmentFilter('')
              setTeamFilter('')
            }}
          >
            <option value="">All Companies</option>
            {lookup?.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <select
            className="select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects
              .filter((p) => !companyFilter || p.company === companyFilter)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value)
              setTeamFilter('')
            }}
          >
            <option value="">All Departments</option>
            {lookup?.departments
              .filter((d) => !companyFilter || d.company_id === companyFilter)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">All Teams</option>
            {lookup?.teams
              .filter(
                (t) =>
                  (!companyFilter || t.company_id === companyFilter) &&
                  (!departmentFilter || t.department_id === departmentFilter),
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">All Owners / Assignees</option>
            {lookup?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
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
          <select
            className="select"
            value={subtaskFilter}
            onChange={(e) => setSubtaskFilter(e.target.value as 'ALL' | 'TOP' | 'SUB')}
          >
            <option value="ALL">Tasks &amp; Subtasks</option>
            <option value="TOP">Top-Level Tasks Only</option>
            <option value="SUB">Subtasks Only</option>
          </select>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            <span>Overdue Only</span>
          </label>
          <button className="btn" onClick={loadTasks}>
            Search
          </button>
        </div>

        {error && <p style={{ color: '#991b1b', marginBottom: '0.75rem' }}>{error}</p>}

        {loading ? (
          <p>Loading tasks from PostgreSQL...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title, Hierarchy &amp; Tags</th>
                <th>Project &amp; Org</th>
                <th>Status &amp; Priority</th>
                <th>Owner &amp; Reviewer</th>
                <th>Assignees (User / Team)</th>
                <th>Progress &amp; Effort</th>
                <th>Due Date</th>
                <th>CRUD Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {t.is_subtask ? `↳ [Subtask] ${t.title}` : t.title}
                    </Link>
                    <div style={{ fontSize: '0.77rem', color: 'var(--muted)' }}>
                      {t.parent_task_title ? `Parent: ${t.parent_task_title} · ` : ''}
                      {t.phase_name ? `Phase: ${t.phase_name} · ` : ''}
                      Method: {t.progress_method}
                      {t.subtasks_count > 0 ? ` · ${t.subtasks_count} subtask(s)` : ''}
                    </div>
                    {t.tags && t.tags.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.25rem',
                          flexWrap: 'wrap',
                          marginTop: '0.25rem',
                        }}
                      >
                        {t.tags.map((tg) => (
                          <span
                            key={tg}
                            className="badge"
                            style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div>
                      <Link to={`/projects/${t.project}`}>
                        <strong>{t.project_code}</strong>
                      </Link>{' '}
                      ({t.company_code || 'CO'})
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                      {t.department_name || '—'}
                      {t.team_name ? ` / ${t.team_name}` : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className={badgeClass(t.status)}>{t.status}</span>
                      <span className={badgeClass(t.priority)}>{t.priority}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div>
                      <strong>Owner:</strong> {t.task_owner_name || '—'}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                      <strong>Rev:</strong> {t.reviewer_name || '—'}
                      {t.approval_required ? ' (Approval Req.)' : ''}
                    </div>
                  </td>
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
                  <td style={{ minWidth: '125px' }}>
                    <div style={{ fontSize: '0.78rem' }}>
                      {Number(t.progress).toFixed(0)}% · {t.actual_effort_hours ?? 0}/
                      {t.estimated_effort ?? 0}h
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Number(t.progress))}%` }}
                      />
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div>{t.due_date || '—'}</div>
                    {t.is_overdue && (
                      <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                        Overdue
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.3rem' }}>
                      <Link to={`/tasks/${t.id}`} className="btn btn-sm">
                        View
                      </Link>
                      <Link to={`/tasks/${t.id}/edit`} className="btn btn-sm">
                        Edit
                      </Link>
                      {!t.is_subtask && (
                        <Link
                          to={`/tasks/new?project=${t.project}&parent=${t.id}`}
                          className="btn btn-sm"
                        >
                          + Subtask
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#991b1b', borderColor: '#fecaca' }}
                        onClick={() => handleDeleteTask(t)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No tasks match the current search/filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
