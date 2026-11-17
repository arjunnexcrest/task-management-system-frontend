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

  // SRS §7.2, §7.4 & §7.10 Bulk Assignment, Priority & Due Dates
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [bulkUser, setBulkUser] = useState('')
  const [bulkTeam, setBulkTeam] = useState('')
  const [bulkPriority, setBulkPriority] = useState<Task['priority'] | ''>('')
  const [bulkDueDate, setBulkDueDate] = useState('')
  const [bulkReplaceExisting, setBulkReplaceExisting] = useState(false)
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

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
      setSelectedTaskIds((prev) => prev.filter((id) => id !== task.id))
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    )
  }

  function toggleSelectAllVisible() {
    if (selectedTaskIds.length === tasks.length && tasks.length > 0) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(tasks.map((t) => t.id))
    }
  }

  async function handleBulkApply() {
    if (selectedTaskIds.length === 0) return
    if (!bulkUser && !bulkTeam && !bulkPriority && !bulkDueDate) {
      setError('Choose at least one field (User, Team, Priority, or Due Date) to apply in bulk.')
      return
    }
    setBulkSaving(true)
    setError(null)
    setBulkSuccess(null)
    try {
      const res = await tasksApi.bulkAssignTasks({
        task_ids: selectedTaskIds,
        user: bulkUser || undefined,
        team: bulkTeam || undefined,
        priority: bulkPriority || undefined,
        due_date: bulkDueDate || undefined,
        replace_existing: bulkReplaceExisting,
      })
      setBulkSuccess(`Updated ${res.updated_count} task(s) successfully.`)
      setSelectedTaskIds([])
      setBulkUser('')
      setBulkTeam('')
      setBulkPriority('')
      setBulkDueDate('')
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assignment failed')
    } finally {
      setBulkSaving(false)
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
        {bulkSuccess && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '0.75rem',
              fontSize: '0.86rem',
            }}
          >
            {bulkSuccess}
          </div>
        )}

        {selectedTaskIds.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              borderRadius: '0.55rem',
              background: '#f8fafc',
              border: '1px solid var(--line-strong)',
            }}
          >
            <strong style={{ fontSize: '0.85rem' }}>
              Bulk Action ({selectedTaskIds.length} selected):
            </strong>
            <select
              className="select"
              style={{ width: 'auto', minWidth: '165px' }}
              value={bulkUser}
              onChange={(e) => setBulkUser(e.target.value)}
            >
              <option value="">Assign User...</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  👤 {u.full_name}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 'auto', minWidth: '155px' }}
              value={bulkTeam}
              onChange={(e) => setBulkTeam(e.target.value)}
            >
              <option value="">Assign Team...</option>
              {lookup?.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  👥 {tm.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 'auto', minWidth: '135px' }}
              value={bulkPriority}
              onChange={(e) => setBulkPriority(e.target.value as Task['priority'] | '')}
            >
              <option value="">Set Priority...</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              title="Set Due Date"
              value={bulkDueDate}
              onChange={(e) => setBulkDueDate(e.target.value)}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={bulkReplaceExisting}
                onChange={(e) => setBulkReplaceExisting(e.target.checked)}
              />
              <span>Reassign (end prior)</span>
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={bulkSaving}
              onClick={handleBulkApply}
            >
              {bulkSaving ? 'Applying...' : 'Apply Bulk Update'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedTaskIds([])}
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <p>Loading tasks from PostgreSQL...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                    onChange={toggleSelectAllVisible}
                    title="Select all visible tasks"
                  />
                </th>
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
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(t.id)}
                      onChange={() => toggleTaskSelection(t.id)}
                    />
                  </td>
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
                    {t.is_overdue ? (
                      <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                        Overdue ({Math.abs(t.days_remaining || 0)}d)
                      </span>
                    ) : t.due_status === 'Due Today' ? (
                      <span className="badge badge-medium" style={{ fontSize: '0.7rem' }}>
                        Due Today
                      </span>
                    ) : t.due_status === 'Due Soon' ? (
                      <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>
                        Due in {t.days_remaining}d
                      </span>
                    ) : null}
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
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>
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
