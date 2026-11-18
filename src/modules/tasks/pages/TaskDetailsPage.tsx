import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  // Workflow Transition State (SRS §7.3 & §22)
  const [transitionReason, setTransitionReason] = useState('')
  const [overrideSubtasks, setOverrideSubtasks] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  // Dependency State
  const [selectedPrereqTask, setSelectedPrereqTask] = useState('')

  // Checklist & Comment State
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [newItemNotes, setNewItemNotes] = useState<Record<string, string>>({})
  const [newItemLink, setNewItemLink] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [mentionUserIds, setMentionUserIds] = useState<string[]>([])
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')

  // Quick Subtask State (SRS §8.1)
  const [quickSubtaskTitle, setQuickSubtaskTitle] = useState('')
  const [quickSubtaskOwner, setQuickSubtaskOwner] = useState('')
  const [quickSubtaskDue, setQuickSubtaskDue] = useState('')

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
      await tasksApi.transitionStatus(id, newStatus, {
        reason: transitionReason.trim() || undefined,
        override_subtasks: overrideSubtasks,
        override_reason: overrideSubtasks ? overrideReason.trim() || undefined : undefined,
      })
      setTransitionReason('')
      setOverrideSubtasks(false)
      setOverrideReason('')
      await refresh()
      setPageSuccess(`Task status transitioned to "${newStatus}" (workflow validated).`)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to transition status')
    }
  }

  async function handleDeleteTask() {
    if (!task) return
    setDeleting(true)
    setPageError(null)
    try {
      await tasksApi.deleteTask(task.id)
      navigate('/tasks')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete task')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
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
    await tasksApi.createChecklistItem({
      checklist: checklistId,
      title: text,
      notes: (newItemNotes[checklistId] || '').trim() || null,
      link: (newItemLink[checklistId] || '').trim() || null,
    })
    setNewItemText((prev) => ({ ...prev, [checklistId]: '' }))
    setNewItemNotes((prev) => ({ ...prev, [checklistId]: '' }))
    setNewItemLink((prev) => ({ ...prev, [checklistId]: '' }))
    await refresh()
  }

  async function handleMoveChecklistItem(checklistId: string, itemId: string, direction: -1 | 1) {
    const cl = task?.checklists.find((c) => c.id === checklistId)
    if (!cl) return
    const ids = cl.items.map((it) => it.id)
    const idx = ids.indexOf(itemId)
    const targetIdx = idx + direction
    if (idx < 0 || targetIdx < 0 || targetIdx >= ids.length) return
    const nextIds = [...ids]
    ;[nextIds[idx], nextIds[targetIdx]] = [nextIds[targetIdx], nextIds[idx]]
    await tasksApi.reorderChecklistItems(checklistId, nextIds)
    await refresh()
  }

  async function handleDeleteChecklistItem(itemId: string) {
    await tasksApi.deleteChecklistItem(itemId)
    await refresh()
  }

  async function handleToggleItem(itemId: string) {
    await tasksApi.toggleChecklistItem(itemId)
    await refresh()
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault()
    if (!id || !commentText.trim()) return
    await tasksApi.addComment({
      task: id,
      content: commentText.trim(),
      parent_comment: replyToId,
      mentioned_user_ids: mentionUserIds,
    })
    setCommentText('')
    setReplyToId(null)
    setMentionUserIds([])
    await refresh()
  }

  async function handleSaveCommentEdit(commentId: string) {
    if (!editingCommentText.trim()) return
    await tasksApi.updateComment(commentId, { content: editingCommentText.trim() })
    setEditingCommentId(null)
    setEditingCommentText('')
    await refresh()
  }

  async function handleDeleteComment(commentId: string) {
    await tasksApi.deleteComment(commentId)
    await refresh()
  }

  async function handleQuickAddSubtask(e: FormEvent) {
    e.preventDefault()
    if (!task || !quickSubtaskTitle.trim()) return
    setPageError(null)
    try {
      await tasksApi.createTask({
        project: task.project,
        parent_task: task.id,
        title: quickSubtaskTitle.trim(),
        task_owner: quickSubtaskOwner || task.task_owner || null,
        due_date: quickSubtaskDue || null,
        priority: task.priority,
        status: 'To Do',
      })
      setQuickSubtaskTitle('')
      setQuickSubtaskDue('')
      await refresh()
      setPageSuccess('Subtask created and linked to parent task.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to create subtask')
    }
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
            onClick={() => setShowDeleteConfirm(true)}
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

      {/* SRS §7.3 TASK STATUS WORKFLOW & VALIDATION CARD */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <p className="eyebrow">SRS §7.3, §14.3 &amp; §22 · Validated Workflow Engine</p>
            <h3 style={{ margin: 0 }}>
              Status Workflow — Current: <span className="badge badge-high">{task.status}</span>
            </h3>
          </div>
          {task.approval_required && (
            <span className="badge badge-medium">
              Approval Required Before Completed
            </span>
          )}
        </div>

        <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
          <div className="form-field">
            <label>Transition Note / Reason (Optional)</label>
            <input
              className="input"
              placeholder="e.g. Ready for QA review, blocked on API credentials..."
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
            />
          </div>
          {task.subtasks.some((st) => st.status !== 'Completed' && st.status !== 'Cancelled') && (
            <div className="form-field">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={overrideSubtasks}
                  onChange={(e) => setOverrideSubtasks(e.target.checked)}
                />
                <span>Authorized Subtask Override (SRS §8.3 &amp; §22 #9)</span>
              </label>
              {overrideSubtasks && (
                <input
                  className="input"
                  placeholder="Required override reason..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.45rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
            Permitted Next Transitions:
          </span>
          {(task.allowed_transitions || []).length > 0 ? (
            (task.allowed_transitions || []).map((nextSt) => (
              <button
                key={nextSt}
                type="button"
                className={
                  nextSt === 'Completed' || nextSt === 'Approved'
                    ? 'btn btn-primary btn-sm'
                    : 'btn btn-sm'
                }
                onClick={() => handleStatusChange(nextSt)}
              >
                → {nextSt}
              </button>
            ))
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              No outgoing transitions configured.
            </span>
          )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Subtasks ({task.subtasks.length})</h3>
              <Link
                to={`/tasks/new?project=${task.project}&parent=${task.id}`}
                className="btn btn-sm"
              >
                Full Form
              </Link>
            </div>

            {/* Quick Inline Subtask Form (SRS §8.1) */}
            <form
              onSubmit={handleQuickAddSubtask}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.45rem',
                marginBottom: '0.85rem',
                padding: '0.65rem',
                borderRadius: '0.5rem',
                background: '#f8fafc',
                border: '1px solid var(--line)',
              }}
            >
              <input
                className="input"
                style={{ flex: '2 1 180px' }}
                placeholder="Quick subtask title..."
                value={quickSubtaskTitle}
                onChange={(e) => setQuickSubtaskTitle(e.target.value)}
              />
              <select
                className="select"
                style={{ flex: '1 1 130px' }}
                value={quickSubtaskOwner}
                onChange={(e) => setQuickSubtaskOwner(e.target.value)}
              >
                <option value="">Owner (Same as parent)</option>
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="input"
                style={{ width: 'auto' }}
                value={quickSubtaskDue}
                onChange={(e) => setQuickSubtaskDue(e.target.value)}
              />
              <button type="submit" className="btn btn-sm btn-primary">
                + Add Subtask
              </button>
            </form>

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
            <div
              key={cl.id}
              style={{
                marginBottom: '1.15rem',
                padding: '0.85rem',
                borderRadius: '0.55rem',
                background: '#f8fafc',
                border: '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 600,
                  marginBottom: '0.55rem',
                }}
              >
                <span>{cl.title}</span>
                <span className="badge badge-active">{cl.completion_percentage}% Done</span>
              </div>
              {cl.items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.4rem 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      flex: 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => handleToggleItem(item.id)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div
                        style={{
                          textDecoration: item.is_completed ? 'line-through' : 'none',
                          color: item.is_completed ? 'var(--muted)' : 'inherit',
                          fontWeight: 500,
                        }}
                      >
                        {item.title}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {item.notes}
                        </div>
                      )}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.76rem', color: '#2563eb', textDecoration: 'underline' }}
                        >
                          {item.link}
                        </a>
                      )}
                    </div>
                  </label>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={idx === 0}
                      title="Move up"
                      onClick={() => handleMoveChecklistItem(cl.id, item.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={idx === cl.items.length - 1}
                      title="Move down"
                      onClick={() => handleMoveChecklistItem(cl.id, item.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: '#991b1b' }}
                      title="Delete item"
                      onClick={() => handleDeleteChecklistItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    className="input"
                    placeholder="Add checklist step..."
                    value={newItemText[cl.id] || ''}
                    onChange={(e) =>
                      setNewItemText((prev) => ({ ...prev, [cl.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => handleAddChecklistItem(cl.id)}
                  >
                    Add Step
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    className="input"
                    placeholder="Optional notes..."
                    value={newItemNotes[cl.id] || ''}
                    onChange={(e) =>
                      setNewItemNotes((prev) => ({ ...prev, [cl.id]: e.target.value }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Optional reference URL (https://...)"
                    value={newItemLink[cl.id] || ''}
                    onChange={(e) =>
                      setNewItemLink((prev) => ({ ...prev, [cl.id]: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* THREADED COMMENTS & @MENTIONS SECTION (SRS §7.7) */}
        <div className="card">
          <h3>Task Discussion, Replies &amp; @Mentions ({task.comments.length})</h3>
          {replyToId && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.4rem 0.65rem',
                marginBottom: '0.5rem',
                borderRadius: '0.4rem',
                background: '#eff6ff',
                fontSize: '0.8rem',
              }}
            >
              <span>
                Replying to{' '}
                <strong>
                  {task.comments.find((c) => c.id === replyToId)?.author_name || 'comment'}
                </strong>
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setReplyToId(null)}>
                Cancel Reply
              </button>
            </div>
          )}
          <form onSubmit={handleAddComment} style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                placeholder={replyToId ? 'Write a reply...' : 'Write a remark or update...'}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                {replyToId ? 'Reply' : 'Post'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="select"
                style={{ width: 'auto', minWidth: '190px', padding: '0.35rem 0.55rem', fontSize: '0.8rem' }}
                value=""
                onChange={(e) => {
                  const uid = e.target.value
                  if (uid && !mentionUserIds.includes(uid)) {
                    setMentionUserIds((prev) => [...prev, uid])
                  }
                }}
              >
                <option value="">+ @Mention employee...</option>
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    @{u.full_name}
                  </option>
                ))}
              </select>
              {mentionUserIds.map((uid) => {
                const u = lookup?.users.find((usr) => usr.id === uid)
                return (
                  <span
                    key={uid}
                    className="badge badge-high"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setMentionUserIds((prev) => prev.filter((i) => i !== uid))}
                    title="Click to remove mention"
                  >
                    @{u?.full_name || 'User'} ×
                  </span>
                )
              })}
            </div>
          </form>

          {task.comments
            .filter((c) => !c.parent_comment)
            .map((c) => {
              const replies = task.comments.filter((r) => r.parent_comment === c.id)
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '0.7rem 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: '0.88rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.author_name}</strong>{' '}
                      <span style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                        · {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setReplyToId(c.id)}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          setEditingCommentId(c.id)
                          setEditingCommentText(c.content)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#991b1b' }}
                        onClick={() => handleDeleteComment(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {editingCommentId === c.id ? (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                      <input
                        className="input"
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSaveCommentEdit(c.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setEditingCommentId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.25rem' }}>{c.content}</div>
                  )}
                  {c.mentions && c.mentions.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                      {c.mentions.map((m) => (
                        <span key={m.id} className="badge badge-high" style={{ fontSize: '0.72rem' }}>
                          @{m.mentioned_user_name}
                        </span>
                      ))}
                    </div>
                  )}
                  {replies.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        marginLeft: '1.25rem',
                        paddingLeft: '0.75rem',
                        borderLeft: '2px solid var(--line-strong)',
                      }}
                    >
                      {replies.map((r) => (
                        <div key={r.id} style={{ padding: '0.35rem 0', fontSize: '0.84rem' }}>
                          <strong>{r.author_name}</strong>{' '}
                          <span style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>
                            · {new Date(r.created_at).toLocaleString()}
                          </span>
                          <div>{r.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Task"
        message={
          task
            ? `Are you sure you want to permanently delete "${task.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Task"
        loading={deleting}
        onConfirm={handleDeleteTask}
        onCancel={() => !deleting && setShowDeleteConfirm(false)}
      />
    </div>
  )
}
