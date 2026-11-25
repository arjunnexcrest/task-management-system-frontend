import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import { ReviewDecisionModal, SubmitForReviewModal } from '@/modules/reviews/components/ReviewModals'
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

const REVIEW_SUBMIT_ELIGIBLE: Task['status'][] = [
  'To Do',
  'Assigned',
  'In Progress',
  'Changes Requested',
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
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllColumns, setShowAllColumns] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters (SRS §12.2)
  const [projectFilter, setProjectFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [depBlockedOnly, setDepBlockedOnly] = useState(false)

  // Integrated Review & Override Modals
  const [submitModalTask, setSubmitModalTask] = useState<Task | null>(null)
  const [reviewModal, setReviewModal] = useState<{
    task: Task
    initialDecision: 'Approved' | 'Changes Requested'
  } | null>(null)
  const [overrideModal, setOverrideModal] = useState<{
    task: Task
    targetStatus: Task['status']
    serverError: string
  } | null>(null)
  const [overrideSubtasks, setOverrideSubtasks] = useState(false)
  const [overrideDependencies, setOverrideDependencies] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), projectsApi.listProjects()])
      .then(([lkp, projs]) => {
        setLookup(lkp)
        setProjects(projs)
      })
      .catch(() => {})
  }, [])

  async function loadBoard() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (projectFilter) params.project = projectFilter
      if (priorityFilter) params.priority = priorityFilter
      if (assigneeFilter) params.assignee = assigneeFilter
      if (overdueOnly) params.overdue = 'true'
      if (depBlockedOnly) params.dependency_blocked = 'true'
      const data = await tasksApi.getKanban(params)
      setColumns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Kanban board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoard()
  }, [projectFilter, priorityFilter, assigneeFilter, overdueOnly, depBlockedOnly])

  async function moveTask(task: Task, newStatus: Task['status']) {
    setError(null)
    setSuccess(null)

    // Route review-sensitive transitions through structured review modals for full audit trail
    if (newStatus === 'In Review' && REVIEW_SUBMIT_ELIGIBLE.includes(task.status)) {
      setSubmitModalTask(task)
      return
    }
    if (
      task.status === 'In Review' &&
      (newStatus === 'Approved' || newStatus === 'Changes Requested')
    ) {
      setReviewModal({ task, initialDecision: newStatus })
      return
    }

    try {
      await tasksApi.transitionStatus(task.id, newStatus)
      setSuccess(`Task "${task.title}" moved to "${newStatus}" (workflow validated).`)
      await loadBoard()
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Cannot move task to "${newStatus}"`
      const lower = msg.toLowerCase()
      if (lower.includes('override_dependencies') || lower.includes('subtask(s) are still open')) {
        setOverrideSubtasks(lower.includes('subtask'))
        setOverrideDependencies(lower.includes('prerequisite') || lower.includes('override_dependencies'))
        setOverrideReason('')
        setOverrideModal({ task, targetStatus: newStatus, serverError: msg })
      } else {
        setError(msg)
      }
    }
  }

  async function handleConfirmOverride(e: FormEvent) {
    e.preventDefault()
    if (!overrideModal) return
    if (!overrideReason.trim()) {
      setError('An authorized override reason is required.')
      return
    }
    setOverrideSaving(true)
    setError(null)
    try {
      await tasksApi.transitionStatus(overrideModal.task.id, overrideModal.targetStatus, {
        override_subtasks: overrideSubtasks,
        override_dependencies: overrideDependencies,
        override_reason: overrideReason.trim(),
      })
      setSuccess(
        `Task "${overrideModal.task.title}" moved to "${overrideModal.targetStatus}" with authorized override recorded.`,
      )
      setOverrideModal(null)
      await loadBoard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override transition failed')
    } finally {
      setOverrideSaving(false)
    }
  }

  const visibleStatuses = showAllColumns ? ALL_WORKFLOW_STATUSES : CORE_STATUSES

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §7.3, §7.9, §12.2 &amp; §14 · Validated Task Status Workflow</p>
          <h1>Interactive Kanban Board</h1>
          <p>
            Move tasks across permitted workflow stages with integrated review/approval modals,
            prerequisite dependency guards, and subtask completion rules.
          </p>
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowAllColumns((prev) => !prev)}
          >
            {showAllColumns ? 'Show Core 5 Columns' : 'Show All 11 SRS Statuses'}
          </button>
          <Link to="/reviews" className="btn">
            Review Queue
          </Link>
          <Link to="/tasks" className="btn">
            List View
          </Link>
          <Link to="/tasks/new" className="btn btn-primary">
            + Create Task
          </Link>
        </div>
      </div>

      {/* SRS §12.2 Kanban Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: 0 }}>
          <select
            className="select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
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
              checked={depBlockedOnly}
              onChange={(e) => setDepBlockedOnly(e.target.checked)}
            />
            <span>Dep. Blocked Only</span>
          </label>
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
            marginBottom: '0.85rem',
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
            marginBottom: '0.85rem',
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
                    <div
                      key={t.id}
                      className="kanban-card"
                      style={{
                        borderColor: t.is_overdue
                          ? '#fecaca'
                          : t.is_dependency_blocked
                            ? '#fde68a'
                            : undefined,
                      }}
                    >
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
                          margin: '0.35rem 0',
                        }}
                      >
                        {t.active_assignments
                          .map((a) =>
                            a.assignment_type === 'User' ? `👤 ${a.user_name}` : `👥 ${a.team_name}`,
                          )
                          .join(', ') || (t.task_owner_name ? `Owner: ${t.task_owner_name}` : 'Unassigned')}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '0.25rem',
                          flexWrap: 'wrap',
                          marginBottom: '0.35rem',
                        }}
                      >
                        {t.approval_required && (
                          <span className="badge badge-medium" style={{ fontSize: '0.66rem' }}>
                            Approval Req.
                          </span>
                        )}
                        {t.is_dependency_blocked && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.66rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                            }}
                          >
                            Dep. Blocked ({t.blocking_prerequisites_count || 1})
                          </span>
                        )}
                        {t.subtasks_count > 0 && (
                          <span className="badge" style={{ fontSize: '0.66rem' }}>
                            {t.subtasks_count} subtask(s)
                          </span>
                        )}
                      </div>

                      {t.due_date && (
                        <div style={{ fontSize: '0.74rem', marginBottom: '0.35rem' }}>
                          Due: {t.due_date}{' '}
                          {t.is_overdue && (
                            <span className="badge badge-critical" style={{ fontSize: '0.66rem' }}>
                              Overdue {t.days_overdue ?? Math.abs(t.days_remaining || 0)}d
                              {t.working_days_overdue !== undefined
                                ? ` (${t.working_days_overdue}w)`
                                : ''}
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
                        onChange={(e) => moveTask(t, e.target.value as Task['status'])}
                      >
                        <option value={t.status}>Current: {t.status}</option>
                        {ALL_WORKFLOW_STATUSES.filter((st) => st !== t.status).map((st) => {
                          const isReviewAction =
                            (t.status === 'In Review' &&
                              (st === 'Approved' || st === 'Changes Requested')) ||
                            (st === 'In Review' && REVIEW_SUBMIT_ELIGIBLE.includes(t.status))
                          const isAllowed = allowed.includes(st) || isReviewAction
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

      {/* Structured Submit-for-Review Modal triggered from Kanban */}
      {submitModalTask && (
        <SubmitForReviewModal
          open
          taskId={submitModalTask.id}
          taskTitle={submitModalTask.title}
          companyId={submitModalTask.company_id}
          isDependencyBlocked={submitModalTask.is_dependency_blocked}
          defaultReviewerId={submitModalTask.reviewer}
          defaultApprovalRequired={submitModalTask.approval_required}
          users={lookup?.users || []}
          onClose={() => setSubmitModalTask(null)}
          onSuccess={async (msg) => {
            setSubmitModalTask(null)
            setSuccess(msg)
            await loadBoard()
          }}
        />
      )}

      {/* Structured Review Decision Modal triggered from Kanban */}
      {reviewModal && (
        <ReviewDecisionModal
          open
          taskId={reviewModal.task.id}
          taskTitle={reviewModal.task.title}
          projectCode={reviewModal.task.project_code}
          companyId={reviewModal.task.company_id}
          defaultReviewerId={reviewModal.task.reviewer || lookup?.users[0]?.id}
          users={lookup?.users || []}
          initialDecision={reviewModal.initialDecision}
          onClose={() => setReviewModal(null)}
          onSuccess={async (msg) => {
            setReviewModal(null)
            setSuccess(msg)
            await loadBoard()
          }}
        />
      )}

      {/* Authorized Dependency / Subtask Override Modal */}
      {overrideModal && (
        <div className="modal-backdrop" onClick={() => !overrideSaving && setOverrideModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '520px', width: '94%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">SRS §7.9, §8.3 &amp; §22 · Authorized Workflow Override</p>
            <h3 className="modal-title">
              Transition &quot;{overrideModal.task.title}&quot; → {overrideModal.targetStatus}
            </h3>
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.45rem',
                fontSize: '0.83rem',
                marginBottom: '0.9rem',
              }}
            >
              {overrideModal.serverError}
            </div>
            <form onSubmit={handleConfirmOverride} style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={overrideDependencies}
                  onChange={(e) => setOverrideDependencies(e.target.checked)}
                />
                <span>Override Unsatisfied Prerequisite Dependencies</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={overrideSubtasks}
                  onChange={(e) => setOverrideSubtasks(e.target.checked)}
                />
                <span>Override Open Subtasks</span>
              </label>
              <div className="form-field">
                <label>Authorized Override Reason *</label>
                <textarea
                  className="textarea"
                  rows={2}
                  required
                  placeholder="Provide auditable reason for overriding workflow guard..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={overrideSaving}
                  onClick={() => setOverrideModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={overrideSaving}
                >
                  {overrideSaving ? 'Applying...' : `Confirm Override → ${overrideModal.targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
