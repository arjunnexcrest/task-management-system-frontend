import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { type Task, type TaskDetail, tasksApi } from '@/modules/tasks/api'

const TASK_STATUSES: Task['status'][] = [
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

export function Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projectTasks, setProjectTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageSuccess, setPageSuccess] = useState<string | null>(null)

  // Assignment Form State
  const [assignType, setAssignType] = useState<'User' | 'Team'>('User')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [entireTeamResponsible, setEntireTeamResponsible] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Schedule & Priority Reschedule State (SRS §7.4 & §7.10)
  const [schedPriority, setSchedPriority] = useState<Task['priority']>('Medium')
  const [schedStartDate, setSchedStartDate] = useState('')
  const [schedDueDate, setSchedDueDate] = useState('')
  const [schedEffort, setSchedEffort] = useState('')
  const [schedReason, setSchedReason] = useState('')
  const [schedSaving, setSchedSaving] = useState(false)

  // Dependency State
  const [selectedPrereqTask, setSelectedPrereqTask] = useState('')

  // Checklist & Comment State
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState('')

  async function refresh() {
    if (!id) return
    const [taskData, lkp] = await Promise.all([tasksApi.getTask(id), projectsApi.getLookup()])
    setTask(taskData)
    setLookup(lkp)
    setSchedPriority(taskData.priority)
    setSchedStartDate(taskData.start_date || '')
    setSchedDueDate(taskData.due_date || '')
    setSchedEffort(taskData.estimated_effort ? String(taskData.estimated_effort) : '')
    if (!selectedUser && lkp.users.length > 0) setSelectedUser(lkp.users[0].id)
    if (!selectedTeam && lkp.teams.length > 0) setSelectedTeam(lkp.teams[0].id)
    tasksApi
      .listTasks({ project: taskData.project })
      .then((list) => {
        const candidates = list.filter((t) => t.id !== taskData.id)
        setProjectTasks(candidates)
        if (candidates.length > 0 && !selectedPrereqTask) {
          setSelectedPrereqTask(candidates[0].id)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    refresh()
      .catch((err) => setPageError(err instanceof Error ? err.message : 'Failed to load task'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleAssign(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setAssignError(null)
    try {
      await tasksApi.assignTask(id, {
        assignment_type: assignType,
        user: assignType === 'User' ? selectedUser : null,
        team: assignType === 'Team' ? selectedTeam : null,
        replace_existing: replaceExisting,
        entire_team_responsible: assignType === 'Team' ? entireTeamResponsible : false,
      })
      await refresh()
      setPageSuccess('Task assignment saved.')
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignment failed')
    }
  }

  async function handleReschedule(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setSchedSaving(true)
    setPageError(null)
    setPageSuccess(null)
    try {
      await tasksApi.rescheduleTask(id, {
        priority: schedPriority,
        start_date: schedStartDate || null,
        due_date: schedDueDate || null,
        estimated_effort: schedEffort ? Number(schedEffort) : null,
        reason: schedReason.trim() || undefined,
      })
      setSchedReason('')
      await refresh()
      setPageSuccess('Priority and due date schedule updated with audit comment.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update schedule & priority')
    } finally {
      setSchedSaving(false)
    }
  }

  async function handleStatusChange(newStatus: TaskDetail['status']) {
    if (!id) return
    setPageError(null)
    setPageSuccess(null)
    try {
      await tasksApi.transitionStatus(id, newStatus)
      await refresh()
      setPageSuccess(`Task status updated to "${newStatus}".`)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to transition status')
    }
  }

  async function handleDeleteTask() {
    if (!task) return
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${task.title}"?`,
    )
    if (!confirmed) return
    setPageError(null)
    try {
      await tasksApi.deleteTask(task.id)
      navigate('/tasks')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  async function handleAddDependency(e: FormEvent) {
    e.preventDefault()
    if (!id || !selectedPrereqTask) return
    setPageError(null)
    try {
      await tasksApi.addDependency({
        task: id,
        depends_on_task: selectedPrereqTask,
        dependency_type: 'Finish-to-Start',
      })
      await refresh()
      setPageSuccess('Prerequisite dependency linked.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to add dependency')
    }
  }

  async function handleRemoveDependency(depId: string) {
    setPageError(null)
    try {
      await tasksApi.deleteDependency(depId)
      await refresh()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to remove dependency')
    }
  }

  async function handleAddChecklist(e: FormEvent) {
    e.preventDefault()
    if (!id || !newChecklistTitle.trim()) return
    await tasksApi.createChecklist({ task: id, title: newChecklistTitle.trim() })
    setNewChecklistTitle('')
    await refresh()
  }

  async function handleAddChecklistItem(checklistId: string) {
    const text = (newItemText[checklistId] || '').trim()
    if (!text) return
    await tasksApi.createChecklistItem({ checklist: checklistId, title: text })
    setNewItemText((prev) => ({ ...prev, [checklistId]: '' }))
    await refresh()
  }

  async function handleToggleItem(itemId: string) {
    await tasksApi.toggleChecklistItem(itemId)
    await refresh()
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault()
    if (!id || !commentText.trim()) return
    await tasksApi.addComment({ task: id, content: commentText.trim() })
    setCommentText('')
    await refresh()
  }

  if (loading) return <p className="page-container">Loading task details...</p>
  if (!task) return <p className="page-container">Task not found.</p>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {task.company_name || 'Company'} ({task.company_code || 'CO'}) ·{' '}
            <Link to={`/projects/${task.project}`}>{task.project_code}</Link> ·{' '}
            {task.is_subtask ? 'Subtask (via parent_task_id)' : 'Primary Task'}
          </p>
          <h1>{task.title}</h1>
          <p>{task.description || 'No description provided.'}</p>
          {task.parent_task && (
            <p style={{ fontSize: '0.84rem', marginTop: '0.35rem' }}>
              Parent Task:{' '}
              <Link to={`/tasks/${task.parent_task}`}>
                <strong>{task.parent_task_title || task.parent_task}</strong>
              </Link>
            </p>
          )}
          {task.tags && task.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              {task.tags.map((tg) => (
                <span key={tg} className="badge">
                  #{tg}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <select
            className="select"
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskDetail['status'])}
          >
            {TASK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <Link to={`/tasks/${task.id}/edit`} className="btn">
            Edit Task
          </Link>
          {!task.is_subtask && (
            <Link
              to={`/tasks/new?project=${task.project}&parent=${task.id}`}
              className="btn btn-primary"
            >
              + Add Subtask
            </Link>
          )}
          <button
            type="button"
            className="btn"
            style={{ color: '#991b1b', borderColor: '#fecaca' }}
            onClick={handleDeleteTask}
          >
            Delete Task
          </button>
          <Link to="/tasks" className="btn">
            All Tasks
          </Link>
        </div>
      </div>

      {pageError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {pageError}
        </div>
      )}

      {pageSuccess && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {pageSuccess}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Status &amp; Priority</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {task.status} · {task.priority}
          </div>
          {task.is_overdue && (
            <span className="badge badge-critical" style={{ marginTop: '0.25rem' }}>
              Overdue
            </span>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Progress ({task.progress_method})</div>
          <div className="stat-value">{Number(task.progress).toFixed(0)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Owner &amp; Reviewer</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            Owner: {task.task_owner_name || 'Unassigned'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Reviewer: {task.reviewer_name || 'None'}{' '}
            {task.approval_required ? '(Mandatory)' : ''}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Schedule &amp; Effort</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            Due: {task.due_date || 'TBD'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Effort: {task.actual_effort_hours ?? 0}h actual / {task.estimated_effort || 0}h est.
          </div>
        </div>
      </div>

      {/* SRS §7.1 Full Task Metadata Summary Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>SRS §7.1 Task Metadata</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <strong>Task ID:</strong> <code>{task.id.slice(0, 8)}...</code>
          </div>
          <div>
            <strong>Company:</strong> {task.company_name || '—'} ({task.company_code || '—'})
          </div>
          <div>
            <strong>Project:</strong>{' '}
            <Link to={`/projects/${task.project}`}>
              {task.project_code} — {task.project_name}
            </Link>
          </div>
          <div>
            <strong>Phase:</strong> {task.phase_name || 'None'}
          </div>
          <div>
            <strong>Department:</strong> {task.department_name || 'None'}
          </div>
          <div>
            <strong>Team:</strong> {task.team_name || 'None'}
          </div>
          <div>
            <strong>Created By:</strong> {task.created_by_name || 'System'}
          </div>
          <div>
            <strong>Start Date:</strong> {task.start_date || '—'}
          </div>
          <div>
            <strong>Due Date:</strong> {task.due_date || '—'}
          </div>
          <div>
            <strong>Created At:</strong> {task.created_at?.slice(0, 10)}
          </div>
          <div>
            <strong>Updated At:</strong> {task.updated_at?.slice(0, 10)}
          </div>
          <div>
            <strong>Completed At:</strong> {task.completed_at ? task.completed_at.slice(0, 10) : '—'}
          </div>
        </div>
      </div>

      {/* PRIORITY & DUE DATE SCHEDULE MANAGEMENT CARD (SRS §7.4 & §7.10) */}
      <form className="card" onSubmit={handleReschedule} style={{ marginBottom: '1.25rem' }}>
        <h3>Priority &amp; Due Date Management (SRS §7.4 &amp; §7.10)</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Priority</label>
            <select
              className="select"
              value={schedPriority}
              onChange={(e) => setSchedPriority(e.target.value as Task['priority'])}
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="form-field">
            <label>Estimated Effort (Hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input"
              value={schedEffort}
              onChange={(e) => setSchedEffort(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Start Date</label>
            <input
              type="date"
              className="input"
              value={schedStartDate}
              onChange={(e) => setSchedStartDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Due Date</label>
            <input
              type="date"
              className="input"
              value={schedDueDate}
              onChange={(e) => setSchedDueDate(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Schedule / Priority Change Reason (Optional audit note)</label>
            <input
              className="input"
              placeholder="e.g. Reprioritized for sprint milestone or extended due date after review..."
              value={schedReason}
              onChange={(e) => setSchedReason(e.target.value)}
            />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={schedSaving}>
            {schedSaving ? 'Updating...' : 'Update Priority & Due Date'}
          </button>
          {task.due_status && (
            <span
              className={
                task.is_overdue
                  ? 'badge badge-critical'
                  : task.due_status === 'Due Today'
                    ? 'badge badge-medium'
                    : 'badge badge-active'
              }
            >
              {task.due_status}
              {task.days_remaining !== null && task.days_remaining !== undefined
                ? ` (${task.days_remaining >= 0 ? `${task.days_remaining}d left` : `${Math.abs(task.days_remaining)}d overdue`})`
                : ''}
            </span>
          )}
        </div>
      </form>

      {/* TASK ASSIGNMENTS SECTION */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h2>Task Assignments (`task_assignments` table)</h2>
        <p style={{ color: 'var(--muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Supports assigning individual Users or entire Teams with full reassignment audit history
          (`ended_at`, `status`).
        </p>

        {assignError && <p style={{ color: '#991b1b' }}>{assignError}</p>}

        <form
          onSubmit={handleAssign}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            marginBottom: '1.25rem',
            padding: '0.9rem',
            background: 'rgba(15, 107, 76, 0.05)',
            borderRadius: '0.65rem',
          }}
        >
          <select
            className="select"
            value={assignType}
            onChange={(e) => setAssignType(e.target.value as 'User' | 'Team')}
          >
            <option value="User">Assign to User</option>
            <option value="Team">Assign to Team</option>
          </select>

          {assignType === 'User' ? (
            <select
              className="select"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  👤 {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          ) : (
            <select
              className="select"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              {lookup?.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  👥 {tm.name} ({tm.code})
                </option>
              ))}
            </select>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.86rem' }}>
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Reassign (end current active assignments)
          </label>

          {assignType === 'Team' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={entireTeamResponsible}
                onChange={(e) => setEntireTeamResponsible(e.target.checked)}
              />
              Entire team responsible (leave individual owner optional)
            </label>
          )}

          <button type="submit" className="btn btn-primary btn-sm">
            + Assign {assignType}
          </button>
        </form>

        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Assignee (User / Team)</th>
              <th>Assigned By</th>
              <th>Status</th>
              <th>Assigned At</th>
              <th>Ended At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {task.assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.assignment_type}</td>
                <td>
                  <strong>
                    {a.assignment_type === 'User'
                      ? `👤 ${a.user_name} (${a.user_email})`
                      : `👥 ${a.team_name}`}
                  </strong>
                </td>
                <td>{a.assigned_by_name || 'System'}</td>
                <td>
                  <span
                    className={
                      a.status === 'Active' || a.status === 'Acknowledged'
                        ? 'badge badge-active'
                        : 'badge'
                    }
                  >
                    {a.status}
                  </span>
                </td>
                <td>{new Date(a.assigned_at).toLocaleString()}</td>
                <td>{a.ended_at ? new Date(a.ended_at).toLocaleString() : 'Active'}</td>
                <td>
                  {(a.status === 'Active' || a.status === 'Acknowledged') && (
                    <div className="btn-row">
                      {a.status === 'Active' && (
                        <button
                          className="btn btn-sm"
                          onClick={() => tasksApi.acknowledgeAssignment(a.id).then(refresh)}
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        onClick={() => tasksApi.endAssignment(a.id, 'Ended').then(refresh)}
                      >
                        End Assignment
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {task.assignments.length === 0 && (
              <tr>
                <td colSpan={7}>No assignments recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PREREQUISITE DEPENDENCIES, SUBTASKS & CHECKLISTS */}
      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="card">
          <h3>Prerequisite Dependencies ({task.dependencies.length})</h3>
          <form
            onSubmit={handleAddDependency}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}
          >
            <select
              className="select"
              value={selectedPrereqTask}
              onChange={(e) => setSelectedPrereqTask(e.target.value)}
            >
              <option value="">Select prerequisite task...</option>
              {projectTasks.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.title} ({pt.status})
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm btn-primary">
              + Link Prerequisite
            </button>
          </form>

          {task.dependencies.map((dep) => (
            <div
              key={dep.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0',
                borderBottom: '1px solid var(--line)',
                fontSize: '0.85rem',
              }}
            >
              <span>
                Depends on:{' '}
                <Link to={`/tasks/${dep.depends_on_task}`}>
                  <strong>{dep.depends_on_title}</strong>
                </Link>{' '}
                <span className="badge">{dep.depends_on_status}</span>
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleRemoveDependency(dep.id)}
              >
                Remove
              </button>
            </div>
          ))}
          {task.dependencies.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              No prerequisite dependencies linked.
            </p>
          )}
        </div>

        {!task.is_subtask && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Subtasks ({task.subtasks.length})</h3>
              <Link
                to={`/tasks/new?project=${task.project}&parent=${task.id}`}
                className="btn btn-sm btn-primary"
              >
                + Add Subtask
              </Link>
            </div>
            {task.subtasks.map((st) => (
              <div
                key={st.id}
                style={{
                  padding: '0.65rem 0',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <Link to={`/tasks/${st.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    ↳ {st.title}
                  </Link>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Owner: {st.task_owner_name || '—'} · Due: {st.due_date || 'TBD'}
                  </div>
                </div>
                <span className="badge badge-in-progress">
                  {st.status} ({Number(st.progress).toFixed(0)}%)
                </span>
              </div>
            ))}
            {task.subtasks.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No subtasks yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="form-grid">
        <div className="card">
          <h3>Checklists ({task.checklists.length})</h3>
          <form
            onSubmit={handleAddChecklist}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}
          >
            <input
              className="input"
              placeholder="New checklist title..."
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary">
              + Checklist
            </button>
          </form>

          {task.checklists.map((cl) => (
            <div key={cl.id} style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  marginBottom: '0.35rem',
                }}
              >
                <span>{cl.title}</span>
                <span>{cl.completion_percentage}%</span>
              </div>
              {cl.items.map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    padding: '0.25rem 0',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => handleToggleItem(item.id)}
                  />
                  <span
                    style={{
                      textDecoration: item.is_completed ? 'line-through' : 'none',
                      color: item.is_completed ? 'var(--muted)' : 'inherit',
                    }}
                  >
                    {item.title}
                  </span>
                </label>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <input
                  className="input"
                  placeholder="Add step..."
                  value={newItemText[cl.id] || ''}
                  onChange={(e) =>
                    setNewItemText((prev) => ({ ...prev, [cl.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleAddChecklistItem(cl.id)}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* COMMENTS SECTION */}
        <div className="card">
          <h3>Task Discussion &amp; Remarks ({task.comments.length})</h3>
          <form
            onSubmit={handleAddComment}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}
          >
            <input
              className="input"
              placeholder="Write a remark or update..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Post
            </button>
          </form>
          {task.comments.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '0.6rem 0',
                borderBottom: '1px solid var(--line)',
                fontSize: '0.9rem',
              }}
            >
              <strong>{c.author_name}</strong>{' '}
              <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                · {new Date(c.created_at).toLocaleString()}
              </span>
              <div style={{ marginTop: '0.2rem' }}>{c.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
