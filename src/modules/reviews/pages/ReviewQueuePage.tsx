import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import {
  type ReviewQueueTask,
  type ReviewSummaryStats,
  type TaskReviewItem,
  reviewsApi,
} from '@/modules/reviews/api'
import { ApprovalChainStepper } from '@/modules/reviews/components/ApprovalChainStepper'
import {
  ApprovalChainConfigModal,
  ReassignReviewerModal,
  ReviewDecisionModal,
  SubmitForReviewModal,
} from '@/modules/reviews/components/ReviewModals'
import { type AttachmentDetail, tasksApi } from '@/modules/tasks/api'

type QueueTab = 'pending' | 'changes_requested' | 'approved' | 'ready_to_submit' | 'history'

function statusBadgeClass(val: string) {
  const s = val.toLowerCase()
  if (s === 'approved' || s === 'completed') return 'badge badge-approved'
  if (s === 'rejected' || s === 'critical' || s === 'blocked') return 'badge badge-critical'
  if (s === 'changes requested' || s === 'in review' || s === 'medium') return 'badge badge-medium'
  if (s === 'high' || s === 'in progress') return 'badge badge-high'
  return 'badge'
}

export function Page() {
  const [activeTab, setActiveTab] = useState<QueueTab>('pending')
  const [queueTasks, setQueueTasks] = useState<ReviewQueueTask[]>([])
  const [historyReviews, setHistoryReviews] = useState<TaskReviewItem[]>([])
  const [summary, setSummary] = useState<ReviewSummaryStats | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  // Filters & Role Context
  const [actingReviewerId, setActingReviewerId] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterReviewer, setFilterReviewer] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterDecision, setFilterDecision] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({})

  // Modals
  const [decisionModal, setDecisionModal] = useState<{
    task: ReviewQueueTask
    initialDecision: 'Approved' | 'Changes Requested' | 'Rejected'
  } | null>(null)
  const [submitModalTask, setSubmitModalTask] = useState<ReviewQueueTask | null>(null)
  const [reassignModalTask, setReassignModalTask] = useState<ReviewQueueTask | null>(null)
  const [showChainConfig, setShowChainConfig] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentDetail | null>(null)
  const [checkingSla, setCheckingSla] = useState(false)

  async function loadMetadata() {
    const [lkp, projs] = await Promise.all([projectsApi.getLookup(), projectsApi.listProjects()])
    setLookup(lkp)
    setProjects(projs)
    if (!actingReviewerId && lkp.users.length > 0) {
      const preferred =
        lkp.users.find((u) => u.designation?.toLowerCase().includes('manager')) || lkp.users[0]
      setActingReviewerId(preferred.id)
    }
  }

  async function loadQueueAndSummary() {
    setLoading(true)
    setError(null)
    try {
      const commonParams: Record<string, string> = {}
      if (filterProject) commonParams.project = filterProject
      if (filterReviewer) commonParams.reviewer = filterReviewer
      if (filterPriority) commonParams.priority = filterPriority
      if (searchQuery.trim()) commonParams.search = searchQuery.trim()

      const sumParams: Record<string, string> = {}
      if (filterProject) sumParams.project = filterProject

      if (activeTab === 'history') {
        const histParams: Record<string, string> = { ...commonParams }
        if (filterDecision) histParams.decision = filterDecision
        const [hist, sumData] = await Promise.all([
          reviewsApi.listReviews(histParams),
          reviewsApi.getSummary(sumParams),
        ])
        setHistoryReviews(hist)
        setSummary(sumData)
      } else {
        const qParams: Record<string, string> = {
          ...commonParams,
          queue_tab: activeTab,
        }
        if (overdueOnly) qParams.overdue_only = 'true'
        const [qData, sumData] = await Promise.all([
          reviewsApi.getReviewQueue(qParams),
          reviewsApi.getSummary(sumParams),
        ])
        setQueueTasks(qData)
        setSummary(sumData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetadata().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load lookup data'),
    )
  }, [])

  useEffect(() => {
    loadQueueAndSummary()
  }, [activeTab, filterProject, filterReviewer, filterPriority, filterDecision, overdueOnly])

  async function handleCompleteApprovedTask(task: ReviewQueueTask) {
    setError(null)
    setSuccess(null)
    try {
      await tasksApi.transitionStatus(task.id, 'Completed', {
        reason: 'Finalized after passing mandatory approval workflow',
      })
      setSuccess(`Task "${task.title}" marked as Completed.`)
      await loadQueueAndSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark task as completed')
    }
  }

  async function handleRunSlaCheck() {
    setCheckingSla(true)
    setError(null)
    setSuccess(null)
    try {
      const report = await reviewsApi.escalateOverdueReviews({
        project: filterProject || undefined,
        trigger_notifications: true,
        force_notify: false,
      })
      setSuccess(
        `SLA Check Complete: Scanned ${report.checked_count} pending review(s) — Found ${report.overdue_count} overdue past threshold (${summary?.rules.escalation_hours || 48}h), dispatched ${report.notifications_sent} reminder notification(s).`,
      )
      await loadQueueAndSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run SLA escalation check')
    } finally {
      setCheckingSla(false)
    }
  }

  function toggleExpand(taskId: string) {
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const users = lookup?.users || []
  const companies = lookup?.companies || []

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Screen #33 · SRS §14.1–§14.4 · Review, Approval &amp; Correction Workflow
          </p>
          <h1>Task Review &amp; Approval Queue</h1>
          <p>
            Manage configurable approval chains, verify deliverables with reference attachments,
            request corrections, reassign reviewers, and monitor SLA escalations.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={handleRunSlaCheck}
            disabled={checkingSla}
          >
            {checkingSla ? 'Checking SLA...' : '⏱ Check SLA Escalations'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowChainConfig(true)}>
            ⚙ Configure Chains &amp; SLA
          </button>
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
          {error}
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

      {/* KPI Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value">{summary?.pending_review_count ?? 0}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Tasks in `In Review`
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-label">Returned for Correction</div>
          <div className="stat-value">{summary?.changes_requested_count ?? 0}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Active rework cycles
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved (Ready to Close)</div>
          <div className="stat-value">{summary?.approved_ready_count ?? 0}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Passed all chain levels
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-label">SLA Overdue Escalations</div>
          <div
            className="stat-value"
            style={{
              color: (summary?.overdue_escalations_count ?? 0) > 0 ? '#991b1b' : undefined,
            }}
          >
            {summary?.overdue_escalations_count ?? 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Threshold: {summary?.rules.escalation_hours ?? 48}h
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-label">First-Pass Approval Rate</div>
          <div className="stat-value">{summary?.first_pass_approval_rate ?? 100}%</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {summary?.total_reviews_logged ?? 0} total review rounds logged
          </span>
        </div>
      </div>

      {/* Main Queue Card */}
      <div className="card">
        {/* Tabs + Acting Reviewer Selector */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="btn-row" style={{ gap: '0.4rem' }}>
            {(
              [
                {
                  key: 'pending',
                  label: `Pending Review (${summary?.pending_review_count ?? 0})`,
                },
                {
                  key: 'changes_requested',
                  label: `Corrections Requested (${summary?.changes_requested_count ?? 0})`,
                },
                {
                  key: 'approved',
                  label: `Approved (${summary?.approved_ready_count ?? 0})`,
                },
                {
                  key: 'ready_to_submit',
                  label: `Ready to Submit (${summary?.ready_to_submit_count ?? 0})`,
                },
                {
                  key: 'history',
                  label: `Audit Log (${summary?.total_reviews_logged ?? 0})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>
              Acting Reviewer:
            </span>
            <select
              className="select"
              style={{ width: 'auto', minWidth: '210px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
              value={actingReviewerId}
              onChange={(e) => setActingReviewerId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || 'Member'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Bar */}
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault()
            loadQueueAndSummary()
          }}
        >
          <input
            className="input"
            placeholder="Search task, project code, owner, comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="select"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
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
            value={filterReviewer}
            onChange={(e) => setFilterReviewer(e.target.value)}
          >
            <option value="">All Reviewers</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          {activeTab === 'history' ? (
            <select
              className="select"
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
            >
              <option value="">All Decisions</option>
              <option value="Approved">Approved</option>
              <option value="Changes Requested">Changes Requested</option>
              <option value="Rejected">Rejected</option>
            </select>
          ) : (
            <select
              className="select"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          )}
          {activeTab === 'pending' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              <span>SLA Overdue Only</span>
            </label>
          )}
          <button type="submit" className="btn btn-sm">
            Search
          </button>
        </form>

        {/* Queue / Audit Content */}
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading review queue...</p>
        ) : activeTab === 'history' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Task &amp; Project</th>
                  <th>Reviewer</th>
                  <th>Decision</th>
                  <th>Comments &amp; Correction Reason</th>
                  <th>Reference Docs</th>
                  <th>Reviewed At</th>
                </tr>
              </thead>
              <tbody>
                {historyReviews.map((rev) => (
                  <tr key={rev.id}>
                    <td>
                      <span className="badge">#{rev.review_round}</span>
                    </td>
                    <td>
                      <Link
                        to={`/tasks/${rev.task}`}
                        style={{ fontWeight: 600, color: 'var(--ink)' }}
                      >
                        {rev.task_title}
                      </Link>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                        {rev.project_code} · Current Status: {rev.task_status}
                      </div>
                    </td>
                    <td>
                      <strong>{rev.reviewer_name}</strong>
                      {rev.reviewer_designation && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {rev.reviewer_designation}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={statusBadgeClass(rev.decision)}>{rev.decision}</span>
                    </td>
                    <td style={{ maxWidth: '340px' }}>
                      {rev.correction_reason && (
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: '#991b1b',
                            background: '#fef2f2',
                            padding: '0.35rem 0.55rem',
                            borderRadius: '0.35rem',
                            marginBottom: rev.comments ? '0.3rem' : 0,
                          }}
                        >
                          <strong>Reason:</strong> {rev.correction_reason}
                        </div>
                      )}
                      {rev.comments && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--ink)' }}>
                          {rev.comments}
                        </div>
                      )}
                    </td>
                    <td>
                      {rev.reference_attachments && rev.reference_attachments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {rev.reference_attachments.map((att) => (
                            <div key={att.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              <a
                                href={tasksApi.getAttachmentUrl(att.id, false)}
                                download={att.file_name}
                                className="badge"
                                style={{ textDecoration: 'none', fontSize: '0.72rem' }}
                              >
                                📎 {att.file_name}
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {new Date(rev.reviewed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {historyReviews.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No historical review decisions match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {queueTasks.map((qt) => {
              const isExpanded = Boolean(expandedTaskIds[qt.id])
              const effectiveReviewer =
                qt.approval_chain.current_reviewer_id || qt.reviewer || actingReviewerId
              return (
                <div
                  key={qt.id}
                  style={{
                    border: qt.sla.is_review_overdue
                      ? '1px solid #fecaca'
                      : '1px solid var(--line)',
                    borderRadius: '0.7rem',
                    padding: '1.15rem 1.25rem',
                    background: qt.sla.is_review_overdue ? '#fffafa' : '#ffffff',
                  }}
                >
                  {/* Card Top Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '0.85rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <div style={{ minWidth: '240px', flex: '1 1 320px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          flexWrap: 'wrap',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span className="badge">{qt.project_code}</span>
                        <span className={statusBadgeClass(qt.status)}>{qt.status}</span>
                        <span className={statusBadgeClass(qt.priority)}>{qt.priority}</span>
                        {qt.approval_required && (
                          <span className="badge badge-medium">Mandatory Approval</span>
                        )}
                        {qt.attachments_count > 0 && (
                          <span className="badge">📎 {qt.attachments_count} file(s)</span>
                        )}
                      </div>
                      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>
                        <Link to={`/tasks/${qt.id}`} style={{ color: 'var(--ink)' }}>
                          {qt.is_subtask ? '↳ ' : ''}
                          {qt.title}
                        </Link>
                      </h3>
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Owner: <strong>{qt.task_owner_name || 'Unassigned'}</strong> · Assigned
                        Reviewer: <strong>{qt.reviewer_name || 'Auto'}</strong> · Progress:{' '}
                        <strong>{Number(qt.progress).toFixed(0)}%</strong> · Due:{' '}
                        <strong>{qt.due_date || 'TBD'}</strong>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="btn-row" style={{ flexWrap: 'wrap' }}>
                      {qt.status === 'In Review' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              setDecisionModal({ task: qt, initialDecision: 'Approved' })
                            }
                          >
                            ✓ Review / Decide
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setDecisionModal({ task: qt, initialDecision: 'Changes Requested' })
                            }
                          >
                            ↺ Request Changes
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setReassignModalTask(qt)}
                          >
                            ⇄ Reassign Reviewer
                          </button>
                        </>
                      )}

                      {(qt.status === 'Changes Requested' ||
                        qt.status === 'In Progress' ||
                        qt.status === 'Assigned' ||
                        qt.status === 'To Do') && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setSubmitModalTask(qt)}
                        >
                          {qt.status === 'Changes Requested'
                            ? '↺ Resubmit for Review'
                            : '→ Submit for Review'}
                        </button>
                      )}

                      {qt.status === 'Approved' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCompleteApprovedTask(qt)}
                        >
                          ✓ Mark Completed
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => toggleExpand(qt.id)}
                      >
                        {isExpanded
                          ? 'Hide History'
                          : `Review History (${qt.reviews_count})`}
                      </button>

                      <Link to={`/tasks/${qt.id}`} className="btn btn-sm">
                        Open Task
                      </Link>
                    </div>
                  </div>

                  {/* Multi-Step Approval Chain Stepper */}
                  <div
                    style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.55rem',
                      background: '#f8fafc',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <ApprovalChainStepper
                      chain={qt.approval_chain}
                      sla={qt.sla}
                      compact
                    />
                  </div>

                  {/* Latest Correction Callout */}
                  {qt.latest_review && qt.latest_review.correction_reason && (
                    <div
                      style={{
                        marginTop: '0.7rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.5rem',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: '0.83rem',
                      }}
                    >
                      <strong>
                        Latest Feedback (Round #{qt.latest_review.review_round} ·{' '}
                        {qt.latest_review.decision} by {qt.latest_review.reviewer_name}):
                      </strong>{' '}
                      {qt.latest_review.correction_reason}
                    </div>
                  )}

                  {/* Expandable Past Rounds & Reference Attachments */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        paddingTop: '0.85rem',
                        borderTop: '1px solid var(--line)',
                        display: 'grid',
                        gap: '0.55rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Previous Review Decisions ({qt.reviews_history.length}) — Active Reviewer:{' '}
                        {users.find((u) => u.id === effectiveReviewer)?.full_name || 'Auto'}
                      </strong>
                      {qt.reviews_history.length === 0 ? (
                        <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                          No review rounds recorded yet for this task.
                        </span>
                      ) : (
                        qt.reviews_history.map((rev) => (
                          <div
                            key={rev.id}
                            style={{
                              padding: '0.65rem 0.8rem',
                              borderRadius: '0.45rem',
                              border: '1px solid var(--line)',
                              background: '#ffffff',
                              fontSize: '0.83rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.4rem',
                              }}
                            >
                              <div>
                                <span className="badge" style={{ marginRight: '0.4rem' }}>
                                  Round #{rev.review_round}
                                </span>
                                <span
                                  className={statusBadgeClass(rev.decision)}
                                  style={{ marginRight: '0.45rem' }}
                                >
                                  {rev.decision}
                                </span>
                                <strong>{rev.reviewer_name}</strong>
                              </div>
                              <span style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                                {new Date(rev.reviewed_at).toLocaleString()}
                              </span>
                            </div>
                            {rev.correction_reason && (
                              <div style={{ color: '#991b1b', marginTop: '0.3rem' }}>
                                <strong>Reason:</strong> {rev.correction_reason}
                              </div>
                            )}
                            {rev.comments && (
                              <div style={{ marginTop: '0.25rem' }}>{rev.comments}</div>
                            )}
                            {rev.reference_attachments && rev.reference_attachments.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.4rem',
                                  marginTop: '0.4rem',
                                }}
                              >
                                {rev.reference_attachments.map((att) => (
                                  <span
                                    key={att.id}
                                    style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      style={{ fontSize: '0.72rem', padding: '0.18rem 0.45rem' }}
                                      onClick={() => setPreviewAttachment(att)}
                                    >
                                      👁 Preview {att.file_name}
                                    </button>
                                    <a
                                      href={tasksApi.getAttachmentUrl(att.id, false)}
                                      download={att.file_name}
                                      className="btn btn-sm"
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.18rem 0.45rem',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      ↓
                                    </a>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {queueTasks.length === 0 && (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  border: '1px dashed var(--line-strong)',
                  borderRadius: '0.6rem',
                }}
              >
                No tasks in this review queue view matching the active filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reviewer Workload & Correction Trends Analytics (SRS §16.3) */}
      {summary &&
        (summary.reviewer_workload.length > 0 || summary.employee_correction_trends.length > 0) && (
          <div className="form-grid">
            <div className="card">
              <h3>Reviewer Workload Distribution</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reviewer</th>
                    <th>Pending</th>
                    <th>Approved</th>
                    <th>Returned / Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.reviewer_workload.map((rw) => (
                    <tr key={rw.reviewer_id}>
                      <td>
                        <strong>{rw.reviewer_name}</strong>
                      </td>
                      <td>
                        <span className="badge badge-medium">{rw.pending_count}</span>
                      </td>
                      <td>
                        <span className="badge badge-approved">{rw.approved_count}</span>
                      </td>
                      <td>
                        <span className="badge badge-critical">{rw.returned_count}</span>
                      </td>
                    </tr>
                  ))}
                  {summary.reviewer_workload.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--muted)' }}>
                        No reviewer workload data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Employee Review &amp; Correction Trends (SRS §16.3)</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task Owner</th>
                    <th>Total Rounds</th>
                    <th>Approved</th>
                    <th>Corrections / Rejections</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.employee_correction_trends.map((ec) => (
                    <tr key={ec.user_id}>
                      <td>
                        <strong>{ec.user_name}</strong>
                      </td>
                      <td>{ec.total_review_events}</td>
                      <td>
                        <span className="badge badge-approved">{ec.approved_events}</span>
                      </td>
                      <td>
                        <span className="badge badge-critical">
                          {ec.correction_or_rejection_events}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {summary.employee_correction_trends.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--muted)' }}>
                        No employee review trend data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Modals */}
      {decisionModal && (
        <ReviewDecisionModal
          open
          taskId={decisionModal.task.id}
          taskTitle={decisionModal.task.title}
          projectCode={decisionModal.task.project_code}
          defaultReviewerId={
            decisionModal.task.approval_chain.current_reviewer_id ||
            decisionModal.task.reviewer ||
            actingReviewerId
          }
          users={users}
          initialDecision={decisionModal.initialDecision}
          onClose={() => setDecisionModal(null)}
          onSuccess={async (msg) => {
            setDecisionModal(null)
            setSuccess(msg)
            await loadQueueAndSummary()
          }}
        />
      )}

      {submitModalTask && (
        <SubmitForReviewModal
          open
          taskId={submitModalTask.id}
          taskTitle={submitModalTask.title}
          defaultReviewerId={submitModalTask.reviewer}
          defaultApprovalRequired={submitModalTask.approval_required}
          users={users}
          onClose={() => setSubmitModalTask(null)}
          onSuccess={async (msg) => {
            setSubmitModalTask(null)
            setSuccess(msg)
            await loadQueueAndSummary()
          }}
        />
      )}

      {reassignModalTask && (
        <ReassignReviewerModal
          open
          taskId={reassignModalTask.id}
          taskTitle={reassignModalTask.title}
          currentReviewerId={reassignModalTask.reviewer}
          users={users}
          onClose={() => setReassignModalTask(null)}
          onSuccess={async (msg) => {
            setReassignModalTask(null)
            setSuccess(msg)
            await loadQueueAndSummary()
          }}
        />
      )}

      <ApprovalChainConfigModal
        open={showChainConfig}
        companies={companies}
        projects={projects}
        onClose={() => setShowChainConfig(false)}
        onSuccess={async (msg) => {
          setShowChainConfig(false)
          setSuccess(msg)
          await loadQueueAndSummary()
        }}
      />

      {/* Document Viewer Modal (Screen #32 integration) */}
      {previewAttachment && (
        <div className="modal-backdrop" onClick={() => setPreviewAttachment(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '760px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.85rem',
              }}
            >
              <div>
                <h3 className="modal-title" style={{ margin: 0 }}>
                  {previewAttachment.file_name}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {previewAttachment.mime_type} · Uploaded by {previewAttachment.uploaded_by_name}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPreviewAttachment(null)}
              >
                Close ×
              </button>
            </div>
            <div
              style={{
                borderRadius: '0.5rem',
                border: '1px solid var(--line)',
                background: '#f8fafc',
                padding: '0.75rem',
                maxHeight: '68vh',
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {previewAttachment.file_category === 'image' ? (
                <img
                  src={tasksApi.getAttachmentUrl(previewAttachment.id, true)}
                  alt={previewAttachment.file_name}
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                />
              ) : previewAttachment.file_category === 'video' ? (
                <video controls style={{ width: '100%', maxHeight: '60vh' }}>
                  <source
                    src={tasksApi.getAttachmentUrl(previewAttachment.id, true)}
                    type={previewAttachment.mime_type}
                  />
                </video>
              ) : (
                <iframe
                  title={previewAttachment.file_name}
                  src={tasksApi.getAttachmentUrl(previewAttachment.id, true)}
                  style={{ width: '100%', height: '60vh', border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
