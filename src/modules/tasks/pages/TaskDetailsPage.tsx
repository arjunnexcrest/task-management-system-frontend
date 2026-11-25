import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { ApprovalChainStepper } from '@/modules/reviews/components/ApprovalChainStepper'
import {
  ApprovalChainConfigModal,
  ReassignReviewerModal,
  ReviewDecisionModal,
  SubmitForReviewModal,
} from '@/modules/reviews/components/ReviewModals'
import {
  type AttachmentDetail,
  type Task,
  type TaskAttachmentItem,
  type TaskDependency,
  type TaskDetail,
  tasksApi,
} from '@/modules/tasks/api'

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

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
  const { can } = usePermissions()
  const canEditTasks = can('can_edit_tasks')
  const canCreateTasks = can('can_create_tasks')
  const canDeleteTasks = can('can_delete_tasks')
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

  // Workflow Transition State (SRS §7.3, §7.9 & §22)
  const [transitionReason, setTransitionReason] = useState('')
  const [overrideSubtasks, setOverrideSubtasks] = useState(false)
  const [overrideDependencies, setOverrideDependencies] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  // Dependency State (SRS §7.9)
  const [selectedPrereqTask, setSelectedPrereqTask] = useState('')
  const [selectedDepType, setSelectedDepType] =
    useState<TaskDependency['dependency_type']>('Finish-to-Start')

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

  // Progress Update & Remarks State (SRS §7.5, §7.6, §9.1, §9.4)
  const [progPct, setProgPct] = useState('0')
  const [progWorkCompleted, setProgWorkCompleted] = useState('')
  const [progRemainingWork, setProgRemainingWork] = useState('')
  const [progRemarks, setProgRemarks] = useState('')
  const [progBlockers, setProgBlockers] = useState('')
  const [progTimeSpent, setProgTimeSpent] = useState('')
  const [progNextAction, setProgNextAction] = useState('')
  const [progAuthor, setProgAuthor] = useState('')
  const [progMarkBlocked, setProgMarkBlocked] = useState(false)
  const [progBlockerImpact, setProgBlockerImpact] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High')
  const [progSaving, setProgSaving] = useState(false)
  const [progFiles, setProgFiles] = useState<File[]>([])

  // Media Attachments & Viewer State (SRS §7.8 & Screen #32)
  const [taskUploadFiles, setTaskUploadFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentDetail | null>(null)
  const [taskAttachmentToDelete, setTaskAttachmentToDelete] = useState<TaskAttachmentItem | null>(
    null,
  )
  const [deletingAttachment, setDeletingAttachment] = useState(false)

  // Review, Approval & Correction State (SRS §14.1–§14.4)
  const [reviewModalDecision, setReviewModalDecision] = useState<
    'Approved' | 'Changes Requested' | 'Rejected' | null
  >(null)
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false)
  const [showReassignReviewerModal, setShowReassignReviewerModal] = useState(false)
  const [showTaskChainModal, setShowTaskChainModal] = useState(false)

  async function refresh() {
    if (!id) return
    const [taskData, lkp] = await Promise.all([tasksApi.getTask(id), projectsApi.getLookup()])
    setTask(taskData)
    setLookup(lkp)
    setSchedPriority(taskData.priority)
    setSchedStartDate(taskData.start_date || '')
    setSchedDueDate(taskData.due_date || '')
    setSchedEffort(taskData.estimated_effort ? String(taskData.estimated_effort) : '')
    setProgPct(String(Math.round(Number(taskData.progress || 0))))
    if (!progAuthor && (taskData.task_owner || lkp.users[0]?.id)) {
      setProgAuthor(taskData.task_owner || lkp.users[0]?.id || '')
    }
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
    if (!id || !task) return
    if (
      task.status === 'In Review' &&
      (newStatus === 'Approved' || newStatus === 'Changes Requested')
    ) {
      setReviewModalDecision(newStatus)
      return
    }
    if (
      newStatus === 'In Review' &&
      ['To Do', 'Assigned', 'In Progress', 'Changes Requested'].includes(task.status) &&
      !transitionReason.trim() &&
      !overrideDependencies
    ) {
      setShowSubmitReviewModal(true)
      return
    }
    setPageError(null)
    setPageSuccess(null)
    try {
      await tasksApi.transitionStatus(id, newStatus, {
        reason: transitionReason.trim() || undefined,
        override_subtasks: overrideSubtasks,
        override_dependencies: overrideDependencies,
        override_reason:
          overrideSubtasks || overrideDependencies ? overrideReason.trim() || undefined : undefined,
      })
      setTransitionReason('')
      setOverrideSubtasks(false)
      setOverrideDependencies(false)
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
    setPageSuccess(null)
    try {
      await tasksApi.addDependency({
        task: id,
        depends_on_task: selectedPrereqTask,
        dependency_type: selectedDepType,
      })
      await refresh()
      setPageSuccess(`Prerequisite dependency (${selectedDepType}) linked.`)
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
    if (!id || (!commentText.trim() && commentFiles.length === 0)) return
    setPageError(null)
    try {
      let uploadedIds: string[] = []
      if (commentFiles.length > 0) {
        const upRes = await tasksApi.uploadFiles(commentFiles, { task: id })
        uploadedIds = upRes.attachments.map((a) => a.id)
      }
      await tasksApi.addComment({
        task: id,
        content: commentText.trim() || `Attached ${commentFiles.length} file(s).`,
        parent_comment: replyToId,
        mentioned_user_ids: mentionUserIds,
        attachment_ids: uploadedIds,
      })
      setCommentText('')
      setReplyToId(null)
      setMentionUserIds([])
      setCommentFiles([])
      await refresh()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to post comment')
    }
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

  async function handleProgressMethodChange(method: Task['progress_method']) {
    if (!task) return
    setPageError(null)
    setPageSuccess(null)
    try {
      await tasksApi.updateTask(task.id, { progress_method: method })
      await refresh()
      setPageSuccess(
        `Progress calculation method changed to "${method}" (SRS §7.6).`,
      )
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update progress method')
    }
  }

  async function handleSubmitProgressUpdate(e: FormEvent) {
    e.preventDefault()
    if (!task) return
    setProgSaving(true)
    setPageError(null)
    setPageSuccess(null)
    try {
      let uploadedIds: string[] = []
      if (progFiles.length > 0) {
        const upRes = await tasksApi.uploadFiles(progFiles, {
          task: task.id,
          uploaded_by: progAuthor || undefined,
        })
        uploadedIds = upRes.attachments.map((a) => a.id)
      }
      await tasksApi.addProgressUpdate(task.id, {
        author: progAuthor || undefined,
        progress_percentage: Number(progPct),
        work_completed: progWorkCompleted.trim() || null,
        remaining_work: progRemainingWork.trim() || null,
        remarks: progRemarks.trim() || null,
        blockers: progBlockers.trim() || null,
        time_spent_minutes: progTimeSpent ? Number(progTimeSpent) : null,
        next_action: progNextAction.trim() || null,
        attachment_ids: uploadedIds,
        mark_task_blocked: progBlockers.trim() ? progMarkBlocked : false,
        blocker_impact: progBlockerImpact,
      })
      setProgWorkCompleted('')
      setProgRemainingWork('')
      setProgRemarks('')
      setProgBlockers('')
      setProgTimeSpent('')
      setProgNextAction('')
      setProgMarkBlocked(false)
      setProgFiles([])
      await refresh()
      setPageSuccess('Progress update and remarks recorded in progress_updates history.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to submit progress update')
    } finally {
      setProgSaving(false)
    }
  }

  async function handleUploadTaskFiles(e: FormEvent) {
    e.preventDefault()
    if (!task || taskUploadFiles.length === 0) return
    setUploadingFiles(true)
    setPageError(null)
    setPageSuccess(null)
    try {
      const res = await tasksApi.uploadFiles(taskUploadFiles, { task: task.id })
      setTaskUploadFiles([])
      await refresh()
      setPageSuccess(
        `Successfully uploaded and validated ${res.uploaded_count} file(s) (SRS §7.8).`,
      )
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'File upload failed')
    } finally {
      setUploadingFiles(false)
    }
  }

  async function confirmDeleteTaskAttachment() {
    if (!taskAttachmentToDelete) return
    setDeletingAttachment(true)
    setPageError(null)
    setPageSuccess(null)
    try {
      await tasksApi.deleteTaskAttachment(taskAttachmentToDelete.id)
      setTaskAttachmentToDelete(null)
      await refresh()
      setPageSuccess('Attachment deleted and storage cleaned up.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete attachment')
      setTaskAttachmentToDelete(null)
    } finally {
      setDeletingAttachment(false)
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
            {TASK_STATUSES.map((st) => {
              const isCurrent = st === task.status
              const isAllowed =
                isCurrent ||
                (task.allowed_transitions || []).includes(st) ||
                (task.status === 'In Review' && (st === 'Approved' || st === 'Changes Requested'))
              return (
                <option key={st} value={st}>
                  {isCurrent ? `Current: ${st}` : isAllowed ? `→ ${st}` : `⛔ ${st} (restricted)`}
                </option>
              )
            })}
          </select>
          {canEditTasks && (
            <Link to={`/tasks/${task.id}/edit`} className="btn">
              Edit Task
            </Link>
          )}
          {canCreateTasks && !task.is_subtask && (
            <Link
              to={`/tasks/new?project=${task.project}&parent=${task.id}`}
              className="btn btn-primary"
            >
              + Add Subtask
            </Link>
          )}
          {canDeleteTasks && (
            <button
              type="button"
              className="btn"
              style={{ color: '#991b1b', borderColor: '#fecaca' }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Task
            </button>
          )}
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

      {task.is_dependency_blocked && (task.dependency_summary?.blocking_prerequisites?.length || 0) > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            padding: '0.8rem 1rem',
            borderRadius: '0.55rem',
            marginBottom: '1rem',
            fontSize: '0.86rem',
          }}
        >
          <strong>Blocked by Prerequisite Dependencies (SRS §7.9):</strong>{' '}
          {task.dependency_summary!.blocking_prerequisites.map((bp, idx) => (
            <span key={bp.dependency_id}>
              {idx > 0 ? ', ' : ''}
              <Link to={`/tasks/${bp.depends_on_task_id}`} style={{ color: '#92400e', fontWeight: 700 }}>
                {bp.depends_on_title}
              </Link>{' '}
              ({bp.dependency_type} · {bp.depends_on_status}
              {bp.is_overdue ? ' · Overdue' : ''})
            </span>
          ))}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Status &amp; Priority</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {task.status} · {task.priority}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {task.is_overdue && (
              <span className="badge badge-critical">
                Overdue {task.days_overdue ?? Math.abs(task.days_remaining || 0)}d
                {task.overdue_severity && task.overdue_severity !== 'None'
                  ? ` (${task.overdue_severity})`
                  : ''}
              </span>
            )}
            {task.is_dependency_blocked && (
              <span
                className="badge"
                style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
              >
                Dep. Blocked ({task.blocking_prerequisites_count || 1})
              </span>
            )}
          </div>
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
          <div className="stat-label">Schedule &amp; Working Days</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            Due: {task.due_date || 'TBD'}
          </div>
          <div style={{ fontSize: '0.78rem', color: task.is_overdue ? '#991b1b' : 'var(--muted)' }}>
            {task.is_overdue
              ? `${task.working_days_overdue ?? 0} working day(s) overdue`
              : task.working_days_remaining !== null && task.working_days_remaining !== undefined
                ? `${task.working_days_remaining} working day(s) left`
                : `Effort: ${task.actual_effort_hours ?? 0}h / ${task.estimated_effort || 0}h`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Effort: {task.actual_effort_hours ?? 0}h actual / {task.estimated_effort || 0}h est.
            {task.planned_working_days ? ` · ${task.planned_working_days} work d span` : ''}
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
          {(task.subtasks.some((st) => st.status !== 'Completed' && st.status !== 'Cancelled') ||
            task.is_dependency_blocked ||
            (task.dependency_summary?.unsatisfied_for_complete?.length || 0) > 0) && (
            <div className="form-field">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {task.subtasks.some((st) => st.status !== 'Completed' && st.status !== 'Cancelled') && (
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
                )}
                {(task.is_dependency_blocked ||
                  (task.dependency_summary?.unsatisfied_for_complete?.length || 0) > 0) && (
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
                      checked={overrideDependencies}
                      onChange={(e) => setOverrideDependencies(e.target.checked)}
                    />
                    <span>Authorized Dependency Override (SRS §7.9 &amp; §22 #20)</span>
                  </label>
                )}
              </div>
              {(overrideSubtasks || overrideDependencies) && (
                <input
                  className="input"
                  style={{ marginTop: '0.35rem' }}
                  placeholder="Required authorized override reason..."
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
                ? ` (${
                    task.days_remaining >= 0
                      ? `${task.days_remaining}d / ${task.working_days_remaining ?? 0} work d left`
                      : `${Math.abs(task.days_remaining)}d / ${task.working_days_overdue ?? 0} work d overdue`
                  })`
                : ''}
            </span>
          )}
          {task.working_calendar && (
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Calendar: {task.working_calendar.working_day_labels.join(', ')} (
              {task.working_calendar.holidays.length} holiday(s))
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div>
              <p className="eyebrow">SRS §7.9 · Dependency Rules &amp; Ripple Impact</p>
              <h3 style={{ margin: 0 }}>
                Task Dependencies ({task.dependencies.length} Upstream ·{' '}
                {task.dependency_summary?.downstream_total_count ?? (task.dependent_tasks?.length || 0)}{' '}
                Downstream)
              </h3>
            </div>
            <Link to={`/projects/${task.project}/timeline`} className="btn btn-sm">
              Timeline Graph →
            </Link>
          </div>

          <form
            onSubmit={handleAddDependency}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.85rem' }}
          >
            <select
              className="select"
              style={{ flex: '2 1 190px' }}
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
            <select
              className="select"
              style={{ flex: '1 1 155px' }}
              value={selectedDepType}
              onChange={(e) =>
                setSelectedDepType(e.target.value as TaskDependency['dependency_type'])
              }
            >
              <option value="Finish-to-Start">Finish-to-Start (FS)</option>
              <option value="Start-to-Start">Start-to-Start (SS)</option>
              <option value="Finish-to-Finish">Finish-to-Finish (FF)</option>
              <option value="Start-to-Finish">Start-to-Finish (SF)</option>
            </select>
            <button type="submit" className="btn btn-sm btn-primary">
              + Link Prerequisite
            </button>
          </form>

          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Upstream Prerequisites ({task.dependencies.length})
          </div>
          {task.dependencies.map((dep) => {
            const isBlocking =
              (task.status === 'In Progress' ||
                task.status === 'In Review' ||
                task.status === 'Changes Requested' ||
                task.status === 'Approved')
                ? dep.is_satisfied_for_complete === false
                : dep.is_satisfied_for_start === false
            return (
              <div
                key={dep.id}
                style={{
                  padding: '0.55rem 0',
                  borderBottom: '1px solid var(--line)',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div>
                    <Link to={`/tasks/${dep.depends_on_task}`} style={{ fontWeight: 600 }}>
                      {dep.depends_on_title}
                    </Link>{' '}
                    <span className="badge" style={{ fontSize: '0.7rem' }}>
                      {dep.dependency_type}
                    </span>{' '}
                    <span className="badge" style={{ fontSize: '0.7rem' }}>
                      {dep.depends_on_status}
                    </span>{' '}
                    {isBlocking ? (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.7rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fde68a',
                        }}
                      >
                        Blocking
                      </span>
                    ) : (
                      <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                        Satisfied
                      </span>
                    )}
                    {dep.depends_on_is_overdue && (
                      <span className="badge badge-critical" style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                        Prereq Overdue
                      </span>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                      Due: {dep.depends_on_due_date || 'TBD'} · Owner: {dep.depends_on_owner_name || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleRemoveDependency(dep.id)}
                  >
                    Remove
                  </button>
                </div>
                {dep.schedule_conflict && (
                  <div
                    style={{
                      marginTop: '0.35rem',
                      padding: '0.35rem 0.55rem',
                      borderRadius: '0.35rem',
                      background: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '0.76rem',
                    }}
                  >
                    ⚠ {dep.schedule_conflict}
                  </div>
                )}
              </div>
            )
          })}
          {task.dependencies.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginTop: 0 }}>
              No upstream prerequisite dependencies linked.
            </p>
          )}

          {/* Downstream Dependent Tasks & Delay Ripple Warnings */}
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              marginTop: '1rem',
              marginBottom: '0.35rem',
            }}
          >
            Downstream Dependent Tasks ({task.dependency_summary?.transitive_dependents?.length || 0})
          </div>
          {(task.dependency_summary?.delay_warnings?.length || 0) > 0 && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.45rem',
                padding: '0.6rem 0.75rem',
                marginBottom: '0.65rem',
                fontSize: '0.8rem',
                color: '#991b1b',
              }}
            >
              <strong>Manager Delay Warnings ({task.dependency_summary!.delay_warnings.length}):</strong>
              <ul style={{ margin: '0.35rem 0 0 1.1rem', padding: 0 }}>
                {task.dependency_summary!.delay_warnings.map((w, i) => (
                  <li key={`${w.affected_task_id}-${i}`} style={{ marginBottom: '0.2rem' }}>
                    <strong>[{w.severity}]</strong> {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(task.dependency_summary?.transitive_dependents || []).map((dt) => (
            <div
              key={dt.dependency_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0',
                borderBottom: '1px solid var(--line)',
                fontSize: '0.83rem',
              }}
            >
              <div>
                <Link to={`/tasks/${dt.task_id}`} style={{ fontWeight: 600 }}>
                  {dt.hop_distance > 1 ? `↳ (Hop ${dt.hop_distance}) ` : '→ '}
                  {dt.title}
                </Link>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                  {dt.dependency_type} · Due: {dt.due_date || 'TBD'} · Owner:{' '}
                  {dt.task_owner_name || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span className="badge" style={{ fontSize: '0.7rem' }}>
                  {dt.status}
                </span>
                {dt.is_overdue && (
                  <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                    Overdue
                  </span>
                )}
              </div>
            </div>
          ))}
          {(task.dependency_summary?.transitive_dependents?.length || 0) === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem', margin: 0 }}>
              No downstream tasks depend on this task.
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
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm,.mov,.zip"
                style={{ fontSize: '0.78rem' }}
                onChange={(e) => setCommentFiles(Array.from(e.target.files || []))}
              />
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
                  {c.attachments && c.attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      {c.attachments.map((ca) => (
                        <a
                          key={ca.id}
                          href={tasksApi.getAttachmentUrl(ca.attachment_detail.id, false)}
                          download={ca.attachment_detail.file_name}
                          className="badge"
                          style={{ textDecoration: 'none', fontSize: '0.74rem' }}
                        >
                          📎 {ca.attachment_detail.file_name} (
                          {formatFileSize(ca.attachment_detail.file_size_bytes)})
                        </a>
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

      {/* PROGRESS UPDATES, CALCULATION METHOD & REMARKS SECTION (SRS §7.5, §7.6, §9.1 & §9.4) */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <p className="eyebrow">SRS §7.5, §7.6 &amp; §9.1 · Append-Only Progress History (`progress_updates`)</p>
            <h2 style={{ margin: 0 }}>
              Progress Updates &amp; Remarks ({(task.progress_updates || []).length})
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
              Calculation Method (SRS §7.6):
            </span>
            <select
              className="select"
              style={{ width: 'auto', minWidth: '185px' }}
              value={task.progress_method}
              onChange={(e) =>
                handleProgressMethodChange(e.target.value as Task['progress_method'])
              }
            >
              <option value="Manual">Manual Percentage</option>
              <option value="Subtasks">Automatic: Weighted Subtasks</option>
              <option value="Checklist">Automatic: Checklist Items</option>
            </select>
            <Link to="/work-log" className="btn btn-sm">
              Daily Work Log →
            </Link>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.6rem',
            background: '#f8fafc',
            border: '1px solid var(--line)',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              marginBottom: '0.4rem',
            }}
          >
            <span>
              <strong>Current Task Progress:</strong> {Number(task.progress).toFixed(1)}% (
              {task.progress_method === 'Manual'
                ? 'Manual — preserved from automatic overwrite per DB Design §5'
                : task.progress_method === 'Subtasks'
                  ? 'Calculated from weighted/equal subtask progress'
                  : 'Calculated from completed checklist items'}
              )
            </span>
            <span className="badge badge-active">{Number(task.progress).toFixed(0)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, Number(task.progress)))}%` }}
            />
          </div>
        </div>

        {/* Submit Progress Update & Remarks Form */}
        <form
          onSubmit={handleSubmitProgressUpdate}
          style={{
            padding: '1rem',
            borderRadius: '0.6rem',
            background: '#f8fafc',
            border: '1px solid var(--line)',
            marginBottom: '1.25rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            Submit Work Progress Update &amp; Remarks
          </h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Reported Progress Percentage ({progPct}%)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progPct}
                  onChange={(e) => setProgPct(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className="input"
                  style={{ width: '80px' }}
                  value={progPct}
                  onChange={(e) => setProgPct(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label>Time Spent (Minutes — Auto-logs to Time Entries)</label>
              <input
                type="number"
                min="0"
                step="5"
                className="input"
                placeholder="e.g. 90"
                value={progTimeSpent}
                onChange={(e) => setProgTimeSpent(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Update Author</label>
              <select
                className="select"
                value={progAuthor}
                onChange={(e) => setProgAuthor(e.target.value)}
              >
                <option value="">Default (Task Owner / Current User)</option>
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Next Planned Action (SRS §7.5 &amp; §9.1)</label>
              <input
                className="input"
                placeholder="e.g. Complete unit tests and request code review..."
                value={progNextAction}
                onChange={(e) => setProgNextAction(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Work Completed (`work_completed`)</label>
              <textarea
                className="textarea"
                rows={2}
                placeholder="Summary of work completed in this update..."
                value={progWorkCompleted}
                onChange={(e) => setProgWorkCompleted(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Remaining Work (`remaining_work`)</label>
              <textarea
                className="textarea"
                rows={2}
                placeholder="Pending deliverables or steps left..."
                value={progRemainingWork}
                onChange={(e) => setProgRemainingWork(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Remarks / Observations (`remarks`)</label>
              <textarea
                className="textarea"
                rows={2}
                placeholder="Enter remarks, notes, or implementation context..."
                value={progRemarks}
                onChange={(e) => setProgRemarks(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Blockers (`blockers` — SRS §7.5 &amp; §9.4)</label>
              <textarea
                className="textarea"
                rows={2}
                placeholder="Leave blank if none, or describe any blocker..."
                value={progBlockers}
                onChange={(e) => setProgBlockers(e.target.value)}
              />
              {progBlockers.trim() && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginTop: '0.4rem',
                    flexWrap: 'wrap',
                  }}
                >
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
                      checked={progMarkBlocked}
                      onChange={(e) => setProgMarkBlocked(e.target.checked)}
                    />
                    <span>Transition task status to Blocked</span>
                  </label>
                  <select
                    className="select"
                    style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                    value={progBlockerImpact}
                    onChange={(e) =>
                      setProgBlockerImpact(
                        e.target.value as 'Low' | 'Medium' | 'High' | 'Critical',
                      )
                    }
                  >
                    <option value="Low">Impact: Low</option>
                    <option value="Medium">Impact: Medium</option>
                    <option value="High">Impact: High</option>
                    <option value="Critical">Impact: Critical</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>
                Attach Media / Deliverables (`progress_attachments`):
              </label>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm,.mov,.zip"
                style={{ fontSize: '0.8rem' }}
                onChange={(e) => setProgFiles(Array.from(e.target.files || []))}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={progSaving}>
              {progSaving ? 'Recording Update...' : '+ Submit Progress Update & Remarks'}
            </button>
          </div>
        </form>

        {/* Append-Only Progress Updates History Feed */}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(task.progress_updates || []).map((pu) => (
            <div
              key={pu.id}
              style={{
                padding: '0.9rem 1rem',
                borderRadius: '0.55rem',
                border: pu.blockers ? '1px solid #fecaca' : '1px solid var(--line)',
                background: pu.blockers ? '#fffafa' : '#ffffff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div>
                  <strong>{pu.author_name}</strong>{' '}
                  <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                    · {new Date(pu.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span className="badge badge-active">
                    {Number(pu.progress_percentage).toFixed(0)}% Progress
                  </span>
                  {pu.time_spent_minutes !== null && pu.time_spent_minutes > 0 && (
                    <span className="badge badge-in-progress">
                      {pu.time_spent_minutes} mins ({(pu.time_spent_minutes / 60).toFixed(1)}h)
                    </span>
                  )}
                  {pu.blockers && <span className="badge badge-critical">Blocker Reported</span>}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.6rem',
                  fontSize: '0.85rem',
                }}
              >
                {pu.work_completed && (
                  <div>
                    <strong style={{ color: 'var(--muted)', fontSize: '0.75rem', display: 'block' }}>
                      WORK COMPLETED
                    </strong>
                    {pu.work_completed}
                  </div>
                )}
                {pu.remaining_work && (
                  <div>
                    <strong style={{ color: 'var(--muted)', fontSize: '0.75rem', display: 'block' }}>
                      REMAINING WORK
                    </strong>
                    {pu.remaining_work}
                  </div>
                )}
                {pu.remarks && (
                  <div>
                    <strong style={{ color: 'var(--muted)', fontSize: '0.75rem', display: 'block' }}>
                      REMARKS
                    </strong>
                    {pu.remarks}
                  </div>
                )}
                {pu.next_action && (
                  <div>
                    <strong style={{ color: 'var(--muted)', fontSize: '0.75rem', display: 'block' }}>
                      NEXT PLANNED ACTION
                    </strong>
                    {pu.next_action}
                  </div>
                )}
              </div>

              {pu.blockers && (
                <div
                  style={{
                    marginTop: '0.6rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    background: '#fef2f2',
                    color: '#991b1b',
                    fontSize: '0.83rem',
                  }}
                >
                  <strong>Blocker:</strong> {pu.blockers}
                </div>
              )}

              {pu.attachments && pu.attachments.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {pu.attachments.map((pa) =>
                    pa.attachment_detail ? (
                      <a
                        key={pa.id}
                        href={tasksApi.getAttachmentUrl(pa.attachment_detail.id, false)}
                        download={pa.attachment_detail.file_name}
                        className="badge"
                        style={{ textDecoration: 'none', fontSize: '0.75rem' }}
                      >
                        📎 {pa.attachment_detail.file_name} (
                        {formatFileSize(pa.attachment_detail.file_size_bytes)})
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          ))}
          {(task.progress_updates || []).length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>
              No progress updates recorded yet. Submit the first update above to log progress percentage,
              work completed, remarks, and time spent.
            </p>
          )}
        </div>
      </div>

      {/* MEDIA ATTACHMENTS & DOCUMENT VIEWER SECTION (SRS §7.8 & Screen #32) */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <p className="eyebrow">
              SRS §7.8 &amp; DB Design §4.5 · Document Storage, Validation, Download &amp; Delete
            </p>
            <h2 style={{ margin: 0 }}>
              Media Attachments &amp; Document Viewer ({(task.task_attachments || []).length})
            </h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Supported: Images (JPG/PNG/WEBP), Docs (PDF/DOCX/XLSX/PPTX/TXT), Video (MP4), Archives (ZIP)
          </span>
        </div>

        {/* Multi-File Upload Form */}
        <form
          onSubmit={handleUploadTaskFiles}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            padding: '0.9rem 1rem',
            borderRadius: '0.6rem',
            background: '#f8fafc',
            border: '1px dashed var(--line-strong)',
            marginBottom: '1.25rem',
          }}
        >
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm,.mov,.zip"
            style={{ flex: '1 1 260px', fontSize: '0.85rem' }}
            onChange={(e) => setTaskUploadFiles(Array.from(e.target.files || []))}
          />
          {taskUploadFiles.length > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {taskUploadFiles.length} file(s) selected (
              {formatFileSize(taskUploadFiles.reduce((acc, f) => acc + f.size, 0))})
            </span>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={uploadingFiles || taskUploadFiles.length === 0}
          >
            {uploadingFiles ? 'Uploading & Validating...' : '+ Upload Attachment(s)'}
          </button>
        </form>

        {/* Attachment Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '0.9rem',
          }}
        >
          {(task.task_attachments || []).map((ta) => {
            const att = ta.attachment_detail
            const inlineUrl = tasksApi.getAttachmentUrl(att.id, true)
            const downloadUrl = tasksApi.getAttachmentUrl(att.id, false)
            return (
              <div
                key={ta.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '0.6rem',
                  padding: '0.9rem',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <strong style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
                      {att.file_name}
                    </strong>
                    <span className="badge badge-active" style={{ textTransform: 'uppercase' }}>
                      {att.file_category || 'file'}
                    </span>
                  </div>

                  {/* Inline Image Thumbnail or Video Player (SRS §7.8) */}
                  {att.file_category === 'image' && (
                    <div
                      style={{
                        marginBottom: '0.5rem',
                        borderRadius: '0.45rem',
                        overflow: 'hidden',
                        border: '1px solid var(--line)',
                        background: '#f8fafc',
                        maxHeight: '150px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => setPreviewAttachment(att)}
                    >
                      <img
                        src={inlineUrl}
                        alt={att.file_name}
                        style={{ maxHeight: '150px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  {att.file_category === 'video' && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <video
                        controls
                        preload="metadata"
                        style={{ width: '100%', maxHeight: '160px', borderRadius: '0.45rem' }}
                      >
                        <source src={inlineUrl} type={att.mime_type} />
                      </video>
                    </div>
                  )}

                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                    <div>
                      Size: <strong>{formatFileSize(att.file_size_bytes)}</strong> · MIME:{' '}
                      <code>{att.mime_type}</code>
                    </div>
                    <div>
                      Uploaded by <strong>{att.uploaded_by_name}</strong> on{' '}
                      {new Date(att.uploaded_at).toLocaleString()}
                    </div>
                    {att.checksum && (
                      <div title={`SHA-256: ${att.checksum}`}>
                        SHA-256: <code>{att.checksum.slice(0, 16)}...</code>
                      </div>
                    )}
                  </div>
                </div>

                <div className="btn-row" style={{ gap: '0.4rem', marginTop: '0.25rem' }}>
                  {(att.file_category === 'image' ||
                    att.file_category === 'video' ||
                    att.mime_type === 'application/pdf' ||
                    att.mime_type.startsWith('text/')) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setPreviewAttachment(att)}
                    >
                      Preview
                    </button>
                  )}
                  <a
                    href={downloadUrl}
                    download={att.file_name}
                    className="btn btn-sm btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ color: '#991b1b', borderColor: '#fecaca' }}
                    onClick={() => setTaskAttachmentToDelete(ta)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {(task.task_attachments || []).length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>
            No files attached to this task yet. Upload images, PDFs, Office documents, videos, or ZIP
            archives above.
          </p>
        )}
      </div>

      {/* REVIEW, APPROVAL CHAIN & CORRECTION HISTORY (SRS §14.1–§14.4) */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <p className="eyebrow">
              SRS §14.1–§14.4 &amp; DB Design §4.6 · Immutable Approval &amp; Correction Log (`task_reviews`)
            </p>
            <h2 style={{ margin: 0 }}>
              Review &amp; Approval Workflow ({(task.reviews || []).length} Round
              {(task.reviews || []).length === 1 ? '' : 's'})
            </h2>
          </div>

          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {['To Do', 'Assigned', 'In Progress', 'Changes Requested', 'In Review'].includes(
              task.status,
            ) && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowSubmitReviewModal(true)}
              >
                {task.status === 'Changes Requested'
                  ? '↺ Resubmit for Review'
                  : task.status === 'In Review'
                    ? 'Update Submission / Reviewer'
                    : '→ Submit for Review'}
              </button>
            )}
            {task.status === 'Approved' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleStatusChange('Completed')}
              >
                ✓ Finalize &amp; Mark Completed
              </button>
            )}
            {task.status === 'In Review' && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setReviewModalDecision('Approved')}
                >
                  ✓ Approve / Decide
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setReviewModalDecision('Changes Requested')}
                >
                  ↺ Request Corrections
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: '#991b1b', borderColor: '#fecaca' }}
                  onClick={() => setReviewModalDecision('Rejected')}
                >
                  ✕ Reject Work
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowReassignReviewerModal(true)}
                >
                  ⇄ Reassign Reviewer
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowTaskChainModal(true)}
            >
              ⚙ Approval Chain Policy
            </button>
            <Link to="/reviews" className="btn btn-sm">
              Review Queue →
            </Link>
          </div>
        </div>

        {task.approval_chain && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.6rem',
              background: '#f8fafc',
              border: '1px solid var(--line)',
              marginBottom: '1rem',
            }}
          >
            <ApprovalChainStepper chain={task.approval_chain} sla={task.review_sla} />
          </div>
        )}

        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {(task.reviews || []).map((rev) => {
            const isApproved = rev.decision === 'Approved'
            const isRejected = rev.decision === 'Rejected'
            return (
              <div
                key={rev.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '0.55rem',
                  border: isApproved
                    ? '1px solid #a7f3d0'
                    : isRejected
                      ? '1px solid #fecaca'
                      : '1px solid #fde68a',
                  background: isApproved ? '#f0fdf4' : isRejected ? '#fef2f2' : '#fffbeb',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span className="badge">Round #{rev.review_round}</span>
                    <span
                      className={
                        isApproved
                          ? 'badge badge-approved'
                          : isRejected
                            ? 'badge badge-critical'
                            : 'badge badge-medium'
                      }
                    >
                      {rev.decision}
                    </span>
                    <strong>{rev.reviewer_name}</strong>
                    {rev.reviewer_designation && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        ({rev.reviewer_designation})
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {new Date(rev.reviewed_at).toLocaleString()}
                  </span>
                </div>

                {rev.correction_reason && (
                  <div
                    style={{
                      marginTop: '0.45rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.4rem',
                      background: '#ffffff',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontSize: '0.83rem',
                    }}
                  >
                    <strong>Correction / Rejection Reason:</strong> {rev.correction_reason}
                  </div>
                )}

                {rev.comments && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--ink)' }}>
                    {rev.comments}
                  </div>
                )}

                {rev.reference_attachments && rev.reference_attachments.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.45rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {rev.reference_attachments.map((att) => (
                      <span
                        key={att.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => setPreviewAttachment(att)}
                        >
                          👁 {att.file_name}
                        </button>
                        <a
                          href={tasksApi.getAttachmentUrl(att.id, false)}
                          download={att.file_name}
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.74rem',
                            padding: '0.2rem 0.45rem',
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
            )
          })}

          {(task.reviews || []).length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>
              No review rounds have been recorded on this task yet. Use &quot;Submit for Review&quot;
              above to initiate the review and approval workflow.
            </p>
          )}
        </div>
      </div>

      {/* Review & Approval Modals */}
      {reviewModalDecision && (
        <ReviewDecisionModal
          open
          taskId={task.id}
          taskTitle={task.title}
          projectCode={task.project_code}
          companyId={task.company_id}
          defaultReviewerId={
            task.approval_chain?.current_reviewer_id || task.reviewer || lookup?.users[0]?.id
          }
          users={lookup?.users || []}
          initialDecision={reviewModalDecision}
          onClose={() => setReviewModalDecision(null)}
          onSuccess={async (msg) => {
            setReviewModalDecision(null)
            await refresh()
            setPageSuccess(msg)
          }}
        />
      )}

      <SubmitForReviewModal
        open={showSubmitReviewModal}
        taskId={task.id}
        taskTitle={task.title}
        companyId={task.company_id}
        isDependencyBlocked={task.is_dependency_blocked}
        defaultReviewerId={task.reviewer}
        defaultApprovalRequired={task.approval_required}
        users={lookup?.users || []}
        onClose={() => setShowSubmitReviewModal(false)}
        onSuccess={async (msg) => {
          setShowSubmitReviewModal(false)
          await refresh()
          setPageSuccess(msg)
        }}
      />

      <ReassignReviewerModal
        open={showReassignReviewerModal}
        taskId={task.id}
        taskTitle={task.title}
        companyId={task.company_id}
        currentReviewerId={task.reviewer}
        users={lookup?.users || []}
        onClose={() => setShowReassignReviewerModal(false)}
        onSuccess={async (msg) => {
          setShowReassignReviewerModal(false)
          await refresh()
          setPageSuccess(msg)
        }}
      />

      <ApprovalChainConfigModal
        open={showTaskChainModal}
        companies={lookup?.companies || []}
        projects={[]}
        initialTaskId={task.id}
        initialTaskTitle={task.title}
        onClose={() => setShowTaskChainModal(false)}
        onSuccess={async (msg) => {
          setShowTaskChainModal(false)
          await refresh()
          setPageSuccess(msg)
        }}
      />

      {/* ATTACHMENT VIEWER / PREVIEW MODAL (Screen #32 — SRS §7.8 & §25) */}
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
                  {formatFileSize(previewAttachment.file_size_bytes)} ·{' '}
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
                alignItems: 'center',
              }}
            >
              {previewAttachment.file_category === 'image' ? (
                <img
                  src={tasksApi.getAttachmentUrl(previewAttachment.id, true)}
                  alt={previewAttachment.file_name}
                  style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain' }}
                />
              ) : previewAttachment.file_category === 'video' ? (
                <video
                  controls
                  autoPlay
                  style={{ width: '100%', maxHeight: '62vh', borderRadius: '0.4rem' }}
                >
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

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <a
                href={tasksApi.getAttachmentUrl(previewAttachment.id, false)}
                download={previewAttachment.file_name}
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Download Original File
              </a>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPreviewAttachment(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ATTACHMENT CONFIRMATION MODAL */}
      <ConfirmDialog
        open={Boolean(taskAttachmentToDelete)}
        title="Delete Attachment"
        message={
          taskAttachmentToDelete
            ? `Are you sure you want to delete "${taskAttachmentToDelete.attachment_detail.file_name}"? This will unlink the file and remove it from storage.`
            : ''
        }
        confirmLabel="Delete Attachment"
        loading={deletingAttachment}
        onConfirm={confirmDeleteTaskAttachment}
        onCancel={() => !deletingAttachment && setTaskAttachmentToDelete(null)}
      />

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
