import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { type TaskDetail, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)

  // Assignment Form State
  const [assignType, setAssignType] = useState<'User' | 'Team'>('User')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Checklist & Comment State
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState('')

  async function refresh() {
    if (!id) return
    const [taskData, lkp] = await Promise.all([tasksApi.getTask(id), projectsApi.getLookup()])
    setTask(taskData)
    setLookup(lkp)
    if (!selectedUser && lkp.users.length > 0) setSelectedUser(lkp.users[0].id)
    if (!selectedTeam && lkp.teams.length > 0) setSelectedTeam(lkp.teams[0].id)
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
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
      })
      await refresh()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignment failed')
    }
  }

  async function handleStatusChange(newStatus: TaskDetail['status']) {
    if (!id) return
    await tasksApi.updateTask(id, { status: newStatus })
    await refresh()
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

  if (loading) return <p>Loading task details...</p>
  if (!task) return <p>Task not found.</p>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {task.project_code} · {task.is_subtask ? 'Subtask (via parent_task_id)' : 'Primary Task'}
          </p>
          <h1>{task.title}</h1>
          <p>{task.description}</p>
        </div>
        <div className="btn-row">
          <select
            className="select"
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskDetail['status'])}
          >
            <option value="Backlog">Backlog</option>
            <option value="To Do">To Do</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Blocked">Blocked</option>
            <option value="In Review">In Review</option>
            <option value="Completed">Completed</option>
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
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Status & Priority</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {task.status} · {task.priority}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Progress ({task.progress_method})</div>
          <div className="stat-value">{Number(task.progress).toFixed(0)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Task Owner</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {task.task_owner_name || 'Unassigned'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Schedule & Effort</div>
          <div className="stat-value" style={{ fontSize: '1.05rem' }}>
            Due: {task.due_date || 'TBD'} ({task.estimated_effort || 0}h)
          </div>
        </div>
      </div>

      {/* TASK ASSIGNMENTS SECTION */}
      <div className="card">
        <h2>Task Assignments (`task_assignments` table)</h2>
        <p style={{ color: 'var(--muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Supports assigning individual Users or entire Teams with full reassignment audit history (`ended_at`, `status`).
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

      {/* SUBTASKS & CHECKLISTS */}
      <div className="form-grid">
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
            {task.subtasks.length === 0 && <p style={{ color: 'var(--muted)' }}>No subtasks yet.</p>}
          </div>
        )}

        <div className="card">
          <h3>Checklists ({task.checklists.length})</h3>
          <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>{cl.title}</span>
                <span>{cl.completion_percentage}%</span>
              </div>
              <div style={{ margin: '0.5rem 0' }}>
                {cl.items.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0',
                      cursor: 'pointer',
                      textDecoration: item.is_completed ? 'line-through' : 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => handleToggleItem(item.id)}
                    />
                    {item.title}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  className="input"
                  placeholder="Add checklist item..."
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
      </div>

      {/* COMMENTS */}
      <div className="card">
        <h3>Task Discussion & Comments ({task.comments.length})</h3>
        {task.comments.map((c) => (
          <div
            key={c.id}
            style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              <strong>{c.author_name}</strong> · {new Date(c.created_at).toLocaleString()}
            </div>
            <div>{c.content}</div>
          </div>
        ))}
        <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Post Comment
          </button>
        </form>
      </div>
    </div>
  )
}
