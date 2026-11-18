import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { SubmitForReviewModal } from '@/modules/reviews/components/ReviewModals'
import { type Task, tasksApi } from '@/modules/tasks/api'

function badgeClass(value: string) {
  const v = value.toLowerCase()
  if (v.includes('completed') || v.includes('approved')) return 'badge badge-active'
  if (v.includes('critical') || v.includes('blocked') || v.includes('overdue'))
    return 'badge badge-critical'
  if (v.includes('high') || v.includes('progress') || v.includes('assigned'))
    return 'badge badge-high'
  if (
    v.includes('medium') ||
    v.includes('review') ||
    v.includes('changes') ||
    v.includes('soon') ||
    v.includes('today')
  )
    return 'badge badge-medium'
  return 'badge'
}

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [submitTask, setSubmitTask] = useState<Task | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function loadAll() {
    const [lkp, tList] = await Promise.all([projectsApi.getLookup(), tasksApi.listTasks()])
    setLookup(lkp)
    setTasks(tList)
    if (!selectedUser && lkp.users.length > 0) {
      setSelectedUser(lkp.users[0].id)
    }
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false))
  }, [])

  async function handleAcknowledge(assignmentId: string) {
    await tasksApi.acknowledgeAssignment(assignmentId)
    await loadAll()
  }

  const userTasks = selectedUser
    ? tasks.filter(
        (t) =>
          t.task_owner === selectedUser ||
          t.active_assignments.some((a) => a.user_id === selectedUser),
      )
    : tasks

  const filteredTasks = userTasks.filter((t) => {
    if (priorityFilter && t.priority !== priorityFilter) return false
    if (statusFilter && t.status !== statusFilter) return false
    if (overdueOnly && !t.is_overdue) return false
    return true
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §7.2, §7.4, §7.10 &amp; §11.5 · Personal Assignment Workspace</p>
          <h1>My Assigned &amp; Owned Tasks</h1>
          <p>
            Track task assignments, acknowledge new tasks, monitor awaiting review &amp; correction
            returns, and submit completed work.
          </p>
        </div>
        <div className="btn-row">
          <select
            className="select"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">All Employees</option>
            {lookup?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">Awaiting Review</option>
            <option value="Changes Requested">Returned for Correction</option>
            <option value="Approved">Approved</option>
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
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
          }}
        >
          {successMsg}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Assigned / Owned</div>
          <div className="stat-value">{userTasks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tasks Awaiting Review</div>
          <div className="stat-value">
            {userTasks.filter((t) => t.status === 'In Review').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Returned for Correction</div>
          <div
            className="stat-value"
            style={{
              color:
                userTasks.filter((t) => t.status === 'Changes Requested').length > 0
                  ? '#92400e'
                  : undefined,
            }}
          >
            {userTasks.filter((t) => t.status === 'Changes Requested').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue Tasks</div>
          <div className="stat-value">{userTasks.filter((t) => t.is_overdue).length}</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading assigned tasks...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task / Subtask</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date &amp; Countdown</th>
                <th>Progress</th>
                <th>Assignment Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const activeAssign = selectedUser
                  ? t.active_assignments.find(
                      (a) => a.user_id === selectedUser && a.status === 'Active',
                    )
                  : undefined
                return (
                  <tr key={t.id}>
                    <td>
                      <Link
                        to={`/tasks/${t.id}`}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        {t.is_subtask ? `↳ ${t.title}` : t.title}
                      </Link>
                    </td>
                    <td>{t.project_code}</td>
                    <td>
                      <span className={badgeClass(t.status)}>{t.status}</span>
                    </td>
                    <td>
                      <span className={badgeClass(t.priority)}>{t.priority}</span>
                    </td>
                    <td>
                      <div>{t.due_date || '—'}</div>
                      {t.due_status && t.due_status !== 'No Due Date' && (
                        <span
                          className={badgeClass(t.due_status)}
                          style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}
                        >
                          {t.due_status}
                          {t.days_remaining !== null && t.days_remaining !== undefined
                            ? ` (${t.days_remaining >= 0 ? `${t.days_remaining}d` : `${Math.abs(t.days_remaining)}d late`})`
                            : ''}
                        </span>
                      )}
                    </td>
                    <td>{Number(t.progress).toFixed(0)}%</td>
                    <td>
                      <div className="btn-row">
                        {activeAssign && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAcknowledge(activeAssign.id)}
                          >
                            Acknowledge
                          </button>
                        )}
                        {(t.status === 'In Progress' ||
                          t.status === 'Changes Requested' ||
                          t.status === 'Assigned') && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setSubmitTask(t)}
                          >
                            {t.status === 'Changes Requested'
                              ? '↺ Resubmit Review'
                              : 'Submit Review'}
                          </button>
                        )}
                        <Link to={`/tasks/${t.id}`} className="btn btn-sm">
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No tasks match the selected employee and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {submitTask && (
        <SubmitForReviewModal
          open
          taskId={submitTask.id}
          taskTitle={submitTask.title}
          defaultReviewerId={submitTask.reviewer}
          defaultApprovalRequired={submitTask.approval_required}
          users={lookup?.users || []}
          onClose={() => setSubmitTask(null)}
          onSuccess={async (msg) => {
            setSubmitTask(null)
            setSuccessMsg(msg)
            await loadAll()
          }}
        />
      )}
    </div>
  )
}
