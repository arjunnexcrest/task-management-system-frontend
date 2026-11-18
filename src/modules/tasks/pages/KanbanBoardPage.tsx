import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Task, tasksApi } from '@/modules/tasks/api'

const CORE_STATUSES: Task['status'][] = [
  'To Do',
  'Assigned',
  'In Progress',
  'In Review',
  'Completed',
]

const ALL_WORKFLOW_STATUSES: Task['status'][] = [
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

function priorityBadgeClass(priority: string) {
  const p = priority.toLowerCase()
  if (p === 'critical') return 'badge badge-critical'
  if (p === 'high') return 'badge badge-high'
  if (p === 'medium') return 'badge badge-medium'
  return 'badge'
}

export function Page() {
  const [columns, setColumns] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)
  const [showAllColumns, setShowAllColumns] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadBoard() {
    setLoading(true)
    try {
      const data = await tasksApi.getKanban()
      setColumns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Kanban board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoard()
  }, [])

  async function moveTask(taskId: string, newStatus: Task['status']) {
    setError(null)
    setSuccess(null)
    try {
      await tasksApi.transitionStatus(taskId, newStatus)
      setSuccess(`Task moved to "${newStatus}" (workflow validated).`)
      await loadBoard()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Cannot move task to "${newStatus}"`)
    }
  }

  const visibleStatuses = showAllColumns ? ALL_WORKFLOW_STATUSES : CORE_STATUSES

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §7.3 &amp; §12.2 · Validated Task Status Workflow</p>
          <h1>Interactive Kanban Board</h1>
          <p>
            Move tasks across permitted workflow stages. Every transition is validated against SRS
            workflow, owner, approval, and subtask rules.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => setShowAllColumns((prev) => !prev)}
          >
            {showAllColumns ? 'Show Core 5 Columns' : 'Show All 11 SRS Statuses'}
          </button>
          <Link to="/tasks" className="btn">
            List View
          </Link>
          <Link to="/tasks/new" className="btn btn-primary">
            + Create Task
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
          }}
        >
          <strong>Workflow Validation Blocked:</strong> {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <p>Loading Kanban board...</p>
      ) : (
        <div className="kanban-grid">
          {visibleStatuses.map((status) => {
            const list = columns[status] || []
            return (
              <div key={status} className="kanban-col">
                <div className="kanban-col-header">
                  <span>{status}</span>
                  <span className="badge">{list.length}</span>
                </div>
                {list.map((t) => {
                  const allowed = t.allowed_transitions || []
                  return (
                    <div key={t.id} className="kanban-card">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span>{t.project_code}</span>
                        <span className={priorityBadgeClass(t.priority)}>{t.priority}</span>
                      </div>
                      <Link
                        to={`/tasks/${t.id}`}
                        style={{ fontWeight: 600, color: 'var(--ink)', display: 'block' }}
                      >
                        {t.title}
                      </Link>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: 'var(--muted)',
                          margin: '0.4rem 0',
                        }}
                      >
                        {t.active_assignments
                          .map((a) =>
                            a.assignment_type === 'User' ? `👤 ${a.user_name}` : `👥 ${a.team_name}`,
                          )
                          .join(', ') || (t.task_owner_name ? `Owner: ${t.task_owner_name}` : 'Unassigned')}
                      </div>
                      {t.due_date && (
                        <div style={{ fontSize: '0.74rem', marginBottom: '0.35rem' }}>
                          Due: {t.due_date}{' '}
                          {t.is_overdue && (
                            <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                              Overdue
                            </span>
                          )}
                        </div>
                      )}
                      <div className="progress-track" style={{ marginBottom: '0.5rem' }}>
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.min(100, Number(t.progress))}%` }}
                        />
                      </div>
                      <select
                        className="select"
                        style={{ width: '100%', padding: '0.32rem 0.5rem', fontSize: '0.78rem' }}
                        value={t.status}
                        onChange={(e) => moveTask(t.id, e.target.value as Task['status'])}
                      >
                        <option value={t.status}>Current: {t.status}</option>
                        {ALL_WORKFLOW_STATUSES.filter((st) => st !== t.status).map((st) => {
                          const isAllowed = allowed.length === 0 || allowed.includes(st)
                          return (
                            <option key={st} value={st}>
                              {isAllowed ? `Move to: ${st}` : `⛔ ${st} (restricted)`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
