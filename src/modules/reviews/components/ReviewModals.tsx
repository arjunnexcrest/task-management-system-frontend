import { type FormEvent, useEffect, useState } from 'react'
import type { LookupData, Project } from '@/modules/projects/api'
import {
  type ApprovalLevel,
  VALID_APPROVAL_LEVELS,
  reviewsApi,
} from '@/modules/reviews/api'

/* ------------------------------------------------------------------ *
 * 1. Review Decision Modal (Approve / Request Corrections / Reject)   *
 * ------------------------------------------------------------------ */
interface ReviewDecisionModalProps {
  open: boolean
  taskId: string
  taskTitle: string
  projectCode?: string
  defaultReviewerId?: string
  users: LookupData['users']
  initialDecision?: 'Approved' | 'Changes Requested' | 'Rejected'
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function ReviewDecisionModal({
  open,
  taskId,
  taskTitle,
  projectCode,
  defaultReviewerId,
  users,
  initialDecision = 'Approved',
  onClose,
  onSuccess,
}: ReviewDecisionModalProps) {
  const [decision, setDecision] = useState<'Approved' | 'Changes Requested' | 'Rejected'>(
    initialDecision,
  )
  const [reviewerId, setReviewerId] = useState(defaultReviewerId || '')
  const [comments, setComments] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDecision(initialDecision)
      setReviewerId(defaultReviewerId || users[0]?.id || '')
      setComments('')
      setCorrectionReason('')
      setFiles([])
      setError(null)
    }
  }, [open, initialDecision, defaultReviewerId, users])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (
      (decision === 'Changes Requested' || decision === 'Rejected') &&
      !correctionReason.trim()
    ) {
      setError('Correction reason is required when requesting corrections or rejecting (SRS §14.2).')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const rev = await reviewsApi.submitDecision({
        task: taskId,
        decision,
        reviewer: reviewerId || undefined,
        comments: comments.trim() || undefined,
        correction_reason: correctionReason.trim() || undefined,
        files,
      })
      onSuccess(
        `Review Round #${rev.review_round} recorded (${rev.decision}) — Task status is now "${rev.task_status}".`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review decision')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="modal-card"
        style={{ maxWidth: '580px', width: '94%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
          }}
        >
          <div>
            <p className="eyebrow">SRS §14.2 · Task Review &amp; Approval Decision</p>
            <h3 className="modal-title">
              {projectCode ? `[${projectCode}] ` : ''}
              {taskTitle}
            </h3>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
            Close ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.45rem',
              fontSize: '0.84rem',
              marginBottom: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div className="form-field">
            <label>Review Decision *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {(
                [
                  {
                    value: 'Approved',
                    label: '✓ Approve',
                    bg: '#ecfdf5',
                    border: '#a7f3d0',
                    color: '#065f46',
                  },
                  {
                    value: 'Changes Requested',
                    label: '↺ Corrections',
                    bg: '#fffbeb',
                    border: '#fde68a',
                    color: '#92400e',
                  },
                  {
                    value: 'Rejected',
                    label: '✕ Reject',
                    bg: '#fef2f2',
                    border: '#fecaca',
                    color: '#991b1b',
                  },
                ] as const
              ).map((opt) => {
                const selected = decision === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setDecision(opt.value)}
                    style={{
                      background: selected ? opt.bg : '#ffffff',
                      borderColor: selected ? opt.border : 'var(--line-strong)',
                      color: selected ? opt.color : 'var(--ink)',
                      fontWeight: selected ? 700 : 500,
                      padding: '0.55rem 0.5rem',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-field">
            <label>Reviewer Performing Decision</label>
            <select
              className="select"
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          {(decision === 'Changes Requested' || decision === 'Rejected') && (
            <div className="form-field">
              <label style={{ color: '#991b1b' }}>
                Correction / Rejection Reason * (Required by DB Design §5 &amp; SRS §14.2)
              </label>
              <textarea
                className="textarea"
                rows={3}
                required
                placeholder="Specify the exact corrections required or reason for rejection..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </div>
          )}

          <div className="form-field">
            <label>Review Comments / Notes</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Optional detailed feedback, review observations, or verification summary..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Attach Reference Documents (SRS §14.2 — PDF, Images, Office Docs)</label>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm,.mov,.zip"
              style={{ fontSize: '0.82rem' }}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                {files.length} reference file(s) attached
              </span>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className={decision === 'Rejected' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
              disabled={submitting}
            >
              {submitting ? 'Recording Decision...' : `Confirm ${decision}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 2. Submit / Resubmit Task for Review Modal                         *
 * ------------------------------------------------------------------ */
interface SubmitForReviewModalProps {
  open: boolean
  taskId: string
  taskTitle: string
  defaultReviewerId?: string | null
  defaultApprovalRequired?: boolean
  users: LookupData['users']
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function SubmitForReviewModal({
  open,
  taskId,
  taskTitle,
  defaultReviewerId,
  defaultApprovalRequired = false,
  users,
  onClose,
  onSuccess,
}: SubmitForReviewModalProps) {
  const [reviewerId, setReviewerId] = useState(defaultReviewerId || '')
  const [notes, setNotes] = useState('')
  const [approvalReq, setApprovalReq] = useState(defaultApprovalRequired)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReviewerId(defaultReviewerId || '')
      setNotes('')
      setApprovalReq(defaultApprovalRequired)
      setFiles([])
      setError(null)
    }
  }, [open, defaultReviewerId, defaultApprovalRequired])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await reviewsApi.submitForReview({
        task: taskId,
        reviewer: reviewerId || null,
        notes: notes.trim() || undefined,
        approval_required: approvalReq,
        files,
      })
      onSuccess(
        `"${res.title}" submitted for review (Assigned Reviewer: ${res.reviewer_name || 'Auto-resolved from Chain'}).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task for review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="modal-card"
        style={{ maxWidth: '520px', width: '94%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
          }}
        >
          <div>
            <p className="eyebrow">SRS §2.6 &amp; §14.1 · Submit Completed Work</p>
            <h3 className="modal-title">{taskTitle}</h3>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
            Close ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.45rem',
              fontSize: '0.84rem',
              marginBottom: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="form-field">
            <label>Target Reviewer (Leave Auto to follow Approval Chain Step 1)</label>
            <select
              className="select"
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
            >
              <option value="">Auto-assign from Configured Approval Chain</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={approvalReq}
              onChange={(e) => setApprovalReq(e.target.checked)}
            />
            <span>Enforce Mandatory Approval before Task Completion (SRS §14.3)</span>
          </label>

          <div className="form-field">
            <label>Submission Summary / Notes for Reviewer</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Summarize deliverables completed, tests verified, or corrections made..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Attach Supporting Deliverables (Optional)</label>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm,.mov,.zip"
              style={{ fontSize: '0.82rem' }}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 3. Reassign Reviewer Modal (SRS §14.2)                             *
 * ------------------------------------------------------------------ */
interface ReassignReviewerModalProps {
  open: boolean
  taskId: string
  taskTitle: string
  currentReviewerId?: string | null
  users: LookupData['users']
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function ReassignReviewerModal({
  open,
  taskId,
  taskTitle,
  currentReviewerId,
  users,
  onClose,
  onSuccess,
}: ReassignReviewerModalProps) {
  const [newReviewerId, setNewReviewerId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const candidate = users.find((u) => u.id !== currentReviewerId) || users[0]
      setNewReviewerId(candidate?.id || '')
      setReason('')
      setError(null)
    }
  }, [open, currentReviewerId, users])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!newReviewerId) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await reviewsApi.reassignReviewer({
        task: taskId,
        new_reviewer: newReviewerId,
        reason: reason.trim() || undefined,
      })
      onSuccess(
        `Reviewer reassigned to ${updated.reviewer_name || 'selected reviewer'} with notification sent.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign reviewer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="modal-card"
        style={{ maxWidth: '480px', width: '94%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <p className="eyebrow">SRS §14.2 · Reviewer Reassignment</p>
            <h3 className="modal-title">{taskTitle}</h3>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
            Close ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.45rem',
              fontSize: '0.84rem',
              marginBottom: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.85rem' }}>
          <div className="form-field">
            <label>New Authorized Reviewer *</label>
            <select
              className="select"
              value={newReviewerId}
              onChange={(e) => setNewReviewerId(e.target.value)}
              required
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Reassignment Reason (Audit Trail)</label>
            <input
              className="input"
              placeholder="e.g. Primary reviewer on leave / Escalated to Project Manager"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Updating...' : 'Reassign Reviewer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 4. Approval Chain & SLA Config Modal (SRS §14.1, §14.4 & §20.2)    *
 * ------------------------------------------------------------------ */
interface ApprovalChainConfigModalProps {
  open: boolean
  companies: LookupData['companies']
  projects: Project[]
  initialTaskId?: string
  initialTaskTitle?: string
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function ApprovalChainConfigModal({
  open,
  companies,
  projects,
  initialTaskId,
  initialTaskTitle,
  onClose,
  onSuccess,
}: ApprovalChainConfigModalProps) {
  const [scope, setScope] = useState<'company' | 'project' | 'task'>(
    initialTaskId ? 'task' : 'company',
  )
  const [companyId, setCompanyId] = useState(companies[0]?.id || '')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [levels, setLevels] = useState<string[]>(['Team Leader', 'Project Manager'])
  const [criticalChain, setCriticalChain] = useState<string>(
    'Team Leader, Department Head, Project Manager',
  )
  const [highChain, setHighChain] = useState<string>('Team Leader, Project Manager')
  const [mediumChain, setMediumChain] = useState<string>('Reviewer')
  const [lowChain, setLowChain] = useState<string>('Reviewer')
  const [escalationHours, setEscalationHours] = useState('48')
  const [allowReassign, setAllowReassign] = useState(true)
  const [addLevelChoice, setAddLevelChoice] = useState<ApprovalLevel>('Department Head')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setScope(initialTaskId ? 'task' : 'company')
    const cid = companies[0]?.id || ''
    setCompanyId(cid)
    if (projects[0]?.id) setProjectId(projects[0].id)
    setError(null)

    reviewsApi
      .getApprovalChainRules(
        initialTaskId ? { task: initialTaskId } : cid ? { company: cid } : undefined,
      )
      .then((res) => {
        if (initialTaskId && res.approval_chain) {
          setLevels(res.approval_chain.levels)
          setEscalationHours(String(res.approval_chain.escalation_hours || 48))
          setAllowReassign(Boolean(res.approval_chain.allow_reviewer_reassignment))
        } else if (res.rules) {
          setLevels(res.rules.default_chain || ['Reviewer'])
          setEscalationHours(String(res.rules.escalation_hours || 48))
          setAllowReassign(Boolean(res.rules.allow_reviewer_reassignment))
          const pc = res.rules.priority_chains || {}
          if (pc.Critical?.length) setCriticalChain(pc.Critical.join(', '))
          if (pc.High?.length) setHighChain(pc.High.join(', '))
          if (pc.Medium?.length) setMediumChain(pc.Medium.join(', '))
          if (pc.Low?.length) setLowChain(pc.Low.join(', '))
        }
      })
      .catch(() => {})
  }, [open, initialTaskId, companies, projects])

  if (!open) return null

  function moveLevel(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= levels.length) return
    const next = [...levels]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setLevels(next)
  }

  function applySrsPreset() {
    setLevels(['Team Leader', 'Project Manager'])
    setCriticalChain('Team Leader, Department Head, Project Manager')
    setHighChain('Team Leader, Project Manager')
    setMediumChain('Reviewer')
    setLowChain('Reviewer')
    setEscalationHours('24')
  }

  function parseCsvLevels(csv: string): string[] {
    return csv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (levels.length === 0) {
      setError('Select at least one approval level.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const priorityChainsPayload =
        scope === 'company'
          ? {
              Critical: parseCsvLevels(criticalChain),
              High: parseCsvLevels(highChain),
              Medium: parseCsvLevels(mediumChain),
              Low: parseCsvLevels(lowChain),
            }
          : undefined

      await reviewsApi.configureApprovalChain({
        scope,
        levels,
        company: scope === 'company' ? companyId || undefined : undefined,
        project: scope === 'project' ? projectId || undefined : undefined,
        task: scope === 'task' ? initialTaskId : undefined,
        priority_chains: priorityChainsPayload,
        escalation_hours: Number(escalationHours) || 48,
        allow_reviewer_reassignment: allowReassign,
      })
      onSuccess(`Approval chain & SLA rules updated for ${scope} scope.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save approval chain rules')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="modal-card"
        style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <p className="eyebrow">SRS §14.1, §14.4 &amp; §20.2 · Configurable Approval Chains</p>
            <h3 className="modal-title">
              {initialTaskTitle ? `Chain Policy: ${initialTaskTitle}` : 'Approval Chains & SLA Rules'}
            </h3>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-sm" onClick={applySrsPreset}>
              SRS Multi-Level Preset
            </button>
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
              Close ×
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.45rem',
              fontSize: '0.84rem',
              marginBottom: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.95rem' }}>
          <div className="form-grid">
            <div className="form-field">
              <label>Configuration Scope</label>
              <select
                className="select"
                value={scope}
                onChange={(e) => setScope(e.target.value as 'company' | 'project' | 'task')}
              >
                {initialTaskId && <option value="task">This Specific Task Only</option>}
                <option value="company">Company-Wide Policy (`approval_chain_rules`)</option>
                <option value="project">Project-Level Override</option>
              </select>
            </div>

            {scope === 'company' && (
              <div className="form-field">
                <label>Target Company</label>
                <select
                  className="select"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Global Default</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'project' && (
              <div className="form-field">
                <label>Target Project</label>
                <select
                  className="select"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.55rem',
              border: '1px solid var(--line)',
              background: '#f8fafc',
            }}
          >
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Ordered Approval Chain Steps (Employee → Step 1 → Step 2 ...)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {levels.map((lvl, idx) => (
                <div
                  key={`${lvl}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#ffffff',
                    border: '1px solid var(--line)',
                    borderRadius: '0.4rem',
                    padding: '0.4rem 0.65rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <span>
                    <strong>Step {idx + 1}:</strong> {lvl}
                  </span>
                  <div className="btn-row" style={{ gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={idx === 0}
                      onClick={() => moveLevel(idx, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={idx === levels.length - 1}
                      onClick={() => moveLevel(idx, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: '#991b1b' }}
                      disabled={levels.length <= 1}
                      onClick={() => setLevels(levels.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
              <select
                className="select"
                value={addLevelChoice}
                onChange={(e) => setAddLevelChoice(e.target.value as ApprovalLevel)}
              >
                {VALID_APPROVAL_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setLevels([...levels, addLevelChoice])}
              >
                + Add Step
              </button>
            </div>
          </div>

          {scope === 'company' && (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '0.55rem',
                border: '1px solid var(--line)',
                background: '#ffffff',
              }}
            >
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Priority-Specific Approval Chains (SRS §14.1: "Not every task requires every approval level")
              </label>
              <div className="form-grid">
                <div className="form-field">
                  <label>Critical Priority Chain</label>
                  <input
                    className="input"
                    value={criticalChain}
                    onChange={(e) => setCriticalChain(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>High Priority Chain</label>
                  <input
                    className="input"
                    value={highChain}
                    onChange={(e) => setHighChain(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Medium Priority Chain</label>
                  <input
                    className="input"
                    value={mediumChain}
                    onChange={(e) => setMediumChain(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Low Priority Chain</label>
                  <input
                    className="input"
                    value={lowChain}
                    onChange={(e) => setLowChain(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label>SLA Review Escalation Interval (Hours — SRS §14.4)</label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                className="input"
                value={escalationHours}
                onChange={(e) => setEscalationHours(e.target.value)}
              />
            </div>

            {scope === 'company' && (
              <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowReassign}
                    onChange={(e) => setAllowReassign(e.target.checked)}
                  />
                  <span>Allow Reviewer Reassignment (SRS §14.2)</span>
                </label>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving Rules...' : 'Save Approval Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
