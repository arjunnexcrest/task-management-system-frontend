import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import {
  type LookupData,
  type ProjectDetail,
  type ProjectMilestone,
  projectsApi,
} from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermissions()
  const canEditProjects = can('can_edit_projects')

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [projectTasks, setProjectTasks] = useState<Task[]>([])
  const [lookup, setLookup] = useState<LookupData | null>(null)

  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [owner, setOwner] = useState('')
  const [completionCriteria, setCompletionCriteria] = useState('')
  const [approvalRequired, setApprovalRequired] = useState(true)

  // Linking tasks & milestone dependencies
  const [linkMilestoneId, setLinkMilestoneId] = useState('')
  const [linkTaskId, setLinkTaskId] = useState('')
  const [depMilestoneId, setDepMilestoneId] = useState('')
  const [depPrereqId, setDepPrereqId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [milestoneToDelete, setMilestoneToDelete] = useState<ProjectMilestone | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    if (!id) return
    const [proj, lkp, tList] = await Promise.all([
      projectsApi.getProject(id),
      projectsApi.getLookup(),
      tasksApi.listTasks({ project: id }),
    ])
    setProject(proj)
    setLookup(lkp)
    setProjectTasks(tList)
    if (proj.milestones.length > 0) {
      if (!linkMilestoneId) setLinkMilestoneId(proj.milestones[0].id)
      if (!depMilestoneId) setDepMilestoneId(proj.milestones[0].id)
    }
    if (tList.length > 0 && !linkTaskId) {
      setLinkTaskId(tList[0].id)
    }
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load milestones'),
    )
  }, [id])

  async function handleAddMilestone(e: FormEvent) {
    e.preventDefault()
    if (!id || !title.trim() || !targetDate) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.createMilestone({
        project: id,
        title: title.trim(),
        target_date: targetDate,
        owner: owner || null,
        completion_criteria: completionCriteria || null,
        status: 'Pending',
        approval_required: approvalRequired,
        progress: 0,
      })
      setTitle('')
      setTargetDate('')
      setCompletionCriteria('')
      setSuccess('Milestone created.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone')
    }
  }

  async function handleLinkTask(e: FormEvent) {
    e.preventDefault()
    if (!linkMilestoneId || !linkTaskId) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.linkMilestoneTask(linkMilestoneId, linkTaskId)
      setSuccess('Task linked to milestone and milestone progress recalculated.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link task to milestone')
    }
  }

  async function handleUnlinkTask(milestoneTaskId: string) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.unlinkMilestoneTask(milestoneTaskId)
      setSuccess('Task unlinked from milestone.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink task')
    }
  }

  async function handleAddDependency(e: FormEvent) {
    e.preventDefault()
    if (!depMilestoneId || !depPrereqId) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.addMilestoneDependency(depMilestoneId, depPrereqId)
      setSuccess('Milestone prerequisite dependency added.')
      setDepPrereqId('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add milestone dependency')
    }
  }

  async function handleRemoveDependency(depId: string) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.removeMilestoneDependency(depId)
      setSuccess('Milestone dependency removed.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove milestone dependency')
    }
  }

  async function handleCompleteMilestone(ms: ProjectMilestone) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.completeMilestone(ms.id)
      setSuccess(`Milestone "${ms.title}" marked Completed (100%).`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot complete milestone yet.')
    }
  }

  async function confirmDeleteMilestone() {
    if (!milestoneToDelete) return
    setDeleting(true)
    setError(null)
    try {
      await projectsApi.deleteMilestone(milestoneToDelete.id)
      setSuccess(`Milestone "${milestoneToDelete.title}" deleted.`)
      setMilestoneToDelete(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete milestone')
      setMilestoneToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!project) return <div className="page-container"><div className="card">Loading project milestones…</div></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">{project.code} · SRS §6.4 &amp; §15 Milestones &amp; Deliverables</p>
          <h1>{project.name} — Milestones</h1>
          <p>
            Manage project milestones, link milestone tasks (`milestone_tasks`), enforce prerequisite
            dependencies (`milestone_dependencies`), and verify completion criteria.
          </p>
        </div>
        <div className="btn-row">
          <Link to={`/projects/${project.id}/planning`} className="btn">
            Phases
          </Link>
          <Link to={`/projects/${project.id}/timeline`} className="btn">
            Timeline
          </Link>
          <Link to={`/projects/${project.id}`} className="btn btn-primary">
            Back to Project Overview
          </Link>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
          {success}
        </div>
      )}

      {canEditProjects && (
        <>
          <form className="card" onSubmit={handleAddMilestone}>
            <h3>Add New Milestone</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Milestone Title *</label>
                <input
                  className="input"
                  required
                  placeholder="e.g. M3: Production Cutover"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Target Date *</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Owner</label>
                <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">Select owner…</option>
                  {lookup?.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Completion Criteria</label>
                <input
                  className="input"
                  placeholder="Acceptance criteria…"
                  value={completionCriteria}
                  onChange={(e) => setCompletionCriteria(e.target.value)}
                />
              </div>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginTop: '0.75rem',
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(e) => setApprovalRequired(e.target.checked)}
              />
              <span>Require explicit milestone sign-off before marking Completed</span>
            </label>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary">
                + Create Milestone
              </button>
            </div>
          </form>

          {project.milestones.length > 0 && (
            <div className="form-grid">
              <form className="card" onSubmit={handleLinkTask}>
                <h3>Link Task to Milestone</h3>
                <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                  <label>Milestone</label>
                  <select
                    className="select"
                    value={linkMilestoneId}
                    onChange={(e) => setLinkMilestoneId(e.target.value)}
                    required
                  >
                    {project.milestones.map((ms) => (
                      <option key={ms.id} value={ms.id}>
                        {ms.title} ({ms.target_date})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field" style={{ marginBottom: '0.9rem' }}>
                  <label>Project Task</label>
                  <select
                    className="select"
                    value={linkTaskId}
                    onChange={(e) => setLinkTaskId(e.target.value)}
                    required
                  >
                    <option value="">Select project task…</option>
                    {projectTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status} · {Number(t.progress).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={!linkTaskId}>
                  + Link Task
                </button>
              </form>

              <form className="card" onSubmit={handleAddDependency}>
                <h3>Add Milestone Prerequisite Dependency</h3>
                <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                  <label>Milestone</label>
                  <select
                    className="select"
                    value={depMilestoneId}
                    onChange={(e) => setDepMilestoneId(e.target.value)}
                    required
                  >
                    {project.milestones.map((ms) => (
                      <option key={ms.id} value={ms.id}>
                        {ms.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field" style={{ marginBottom: '0.9rem' }}>
                  <label>Depends On Prerequisite Milestone</label>
                  <select
                    className="select"
                    value={depPrereqId}
                    onChange={(e) => setDepPrereqId(e.target.value)}
                    required
                  >
                    <option value="">Select prerequisite milestone…</option>
                    {project.milestones
                      .filter((ms) => ms.id !== depMilestoneId)
                      .map((ms) => (
                        <option key={ms.id} value={ms.id}>
                          {ms.title} ({ms.status})
                        </option>
                      ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={!depPrereqId}>
                  + Add Dependency
                </button>
              </form>
            </div>
          )}
        </>
      )}

      <div className="card">
        <h3>Milestones ({project.milestones.length})</h3>
        {project.milestones.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No milestones defined for this project yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Target Date</th>
                <th>Status</th>
                <th>Linked Tasks</th>
                <th>Prerequisites</th>
                <th>Progress</th>
                {canEditProjects && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {project.milestones.map((ms) => (
                <tr key={ms.id}>
                  <td>
                    <strong>{ms.title}</strong>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      Owner: {ms.owner_name || 'Unassigned'}
                      {ms.approval_required ? ' · Approval Required' : ''}
                    </div>
                    {ms.completion_criteria && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                        Criteria: {ms.completion_criteria}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.84rem' }}>
                    <div>{ms.target_date}</div>
                    {ms.is_overdue && (
                      <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                        Overdue
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        ms.status === 'Completed'
                          ? 'badge-active'
                          : ms.status === 'Delayed'
                            ? 'badge-critical'
                            : 'badge-medium'
                      }`}
                    >
                      {ms.status}
                    </span>
                    {ms.is_blocked_by_dependencies && (
                      <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.2rem' }}>
                        Blocked by prereq
                      </div>
                    )}
                  </td>
                  <td>
                    {ms.milestone_tasks.length === 0 ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>None</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {ms.milestone_tasks.map((mt) => (
                          <div
                            key={mt.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                          >
                            <Link to={`/tasks/${mt.task}`} style={{ color: 'var(--accent-brand)' }}>
                              {mt.task_title}
                            </Link>
                            <span className="badge" style={{ fontSize: '0.68rem' }}>
                              {mt.task_status}
                            </span>
                            {canEditProjects && (
                              <button
                                type="button"
                                onClick={() => handleUnlinkTask(mt.id)}
                                title="Unlink task"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#991b1b',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {ms.dependencies.length === 0 ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>None</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {ms.dependencies.map((d) => (
                          <div
                            key={d.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                          >
                            <span>{d.depends_on_title}</span>
                            <span className="badge" style={{ fontSize: '0.68rem' }}>
                              {d.depends_on_status}
                            </span>
                            {canEditProjects && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDependency(d.id)}
                                title="Remove dependency"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#991b1b',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ fontSize: '0.78rem', marginBottom: '0.18rem' }}>
                      {Number(ms.progress).toFixed(0)}%
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Number(ms.progress))}%` }}
                      />
                    </div>
                  </td>
                  {canEditProjects && (
                    <td>
                      <div className="btn-row">
                        {ms.status !== 'Completed' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleCompleteMilestone(ms)}
                          >
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ color: '#991b1b', borderColor: '#fecaca' }}
                          onClick={() => setMilestoneToDelete(ms)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(milestoneToDelete)}
        title="Delete Milestone"
        message={
          milestoneToDelete
            ? `Permanently delete milestone "${milestoneToDelete.title}"?`
            : ''
        }
        confirmLabel="Delete Milestone"
        loading={deleting}
        onConfirm={confirmDeleteMilestone}
        onCancel={() => setMilestoneToDelete(null)}
      />
    </div>
  )
}
