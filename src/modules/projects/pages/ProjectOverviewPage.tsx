import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type LookupData, type ProjectDetail, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Close Project state (SRS §6.6)
  const [showCloseBox, setShowCloseBox] = useState(false)
  const [closureRemarks, setClosureRemarks] = useState('')

  // Add Member state
  const [newMemberUser, setNewMemberUser] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('Team Member')

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    if (!id) return
    setLoading(true)
    try {
      const [projData, taskData, lookupData] = await Promise.all([
        projectsApi.getProject(id),
        tasksApi.listTasks({ project: id }),
        projectsApi.getLookup(),
      ])
      setProject(projData)
      setTasks(taskData)
      setLookup(lookupData)
      if (lookupData.users.length > 0 && !newMemberUser) {
        setNewMemberUser(lookupData.users[0].id)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecalculateProgress() {
    if (!project) return
    setActionError(null)
    try {
      const updated = await projectsApi.recalculateProgress(project.id)
      setProject(updated)
      setActionSuccess('Project progress recalculated from task completion.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to recalculate progress')
    }
  }

  async function handleCloseProject(e: FormEvent) {
    e.preventDefault()
    if (!project) return
    setActionError(null)
    try {
      const closed = await projectsApi.closeProject(project.id, closureRemarks)
      setProject(closed)
      setShowCloseBox(false)
      setActionSuccess('Project closed and marked Completed (SRS §6.6).')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to close project')
    }
  }

  async function handleArchiveProject() {
    if (!project) return
    setActionError(null)
    try {
      const archived = await projectsApi.archiveProject(project.id)
      setProject(archived)
      setActionSuccess('Project archived while preserving historical records.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive project')
    }
  }

  async function handleDeleteProject() {
    if (!project) return
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete project "${project.code} — ${project.name}"?`,
    )
    if (!confirmed) return
    try {
      await projectsApi.deleteProject(project.id)
      navigate('/projects')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (!project || !newMemberUser) return
    setActionError(null)
    try {
      await projectsApi.addProjectMember({
        project: project.id,
        user: newMemberUser,
        role_in_project: newMemberRole || 'Team Member',
      })
      await loadData()
      setActionSuccess('Member added to project.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  async function handleRemoveMember(memberRecordId: string) {
    setActionError(null)
    try {
      await projectsApi.removeProjectMember(memberRecordId)
      await loadData()
      setActionSuccess('Member removed from project.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  if (loading) return <p className="page-container">Loading project dashboard...</p>
  if (!project) return <p className="page-container">Project not found.</p>

  const summary = project.dashboard_summary

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            SRS §6.5 Project Dashboard · {project.company_name} ({project.company_code}) ·{' '}
            {project.code}
          </p>
          <h1>{project.name}</h1>
          <p>{project.description || 'No description provided.'}</p>
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <Link to={`/projects/${project.id}/assignments`} className="btn btn-primary">
            PM &amp; Dept Mapping
          </Link>
          <Link to={`/projects/${project.id}/edit`} className="btn">
            Edit Project
          </Link>
          <Link to={`/projects/${project.id}/planning`} className="btn">
            Phases ({project.phases.length})
          </Link>
          <Link to={`/projects/${project.id}/milestones`} className="btn">
            Milestones ({project.milestones.length})
          </Link>
          <Link to={`/projects/${project.id}/timeline`} className="btn">
            Timeline
          </Link>
          <button type="button" className="btn" onClick={handleRecalculateProgress}>
            Recalculate %
          </button>
          {project.status !== 'Completed' && (
            <button
              type="button"
              className="btn"
              onClick={() => setShowCloseBox(!showCloseBox)}
            >
              Close Project
            </button>
          )}
          {project.status !== 'Archived' && (
            <button type="button" className="btn" onClick={handleArchiveProject}>
              Archive
            </button>
          )}
          <button
            type="button"
            className="btn"
            style={{ color: '#991b1b', borderColor: '#fecaca' }}
            onClick={handleDeleteProject}
          >
            Delete
          </button>
          <Link to={`/tasks/new?project=${project.id}`} className="btn btn-primary">
            + Add Task
          </Link>
        </div>
      </div>

      {actionError && (
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
          {actionError}
        </div>
      )}

      {actionSuccess && (
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
          {actionSuccess}
        </div>
      )}

      {showCloseBox && (
        <form className="card" onSubmit={handleCloseProject} style={{ marginBottom: '1.25rem' }}>
          <h3>Close Project (SRS §6.6 Project Closure)</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
            All required tasks must be completed or cancelled, and closure remarks must be recorded
            before closing.
          </p>
          <div className="form-field" style={{ marginTop: '0.75rem' }}>
            <label>Closure Remarks *</label>
            <textarea
              className="textarea"
              required
              rows={2}
              placeholder="Summarize final deliverables, approvals, and sign-off notes..."
              value={closureRemarks}
              onChange={(e) => setClosureRemarks(e.target.value)}
            />
          </div>
          <div className="btn-row" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              Confirm Project Closure
            </button>
            <button type="button" className="btn" onClick={() => setShowCloseBox(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Status & Priority</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {project.status} · {project.priority}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            PM: {project.project_manager_name || 'Unassigned'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Overall Completion</div>
          <div className="stat-value">{Number(project.progress).toFixed(0)}%</div>
          <div className="progress-track" style={{ marginTop: '0.35rem' }}>
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, Number(project.progress))}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Task Breakdown (SRS §6.5)</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {summary?.completed_tasks ?? project.completed_tasks_count}/
            {summary?.total_tasks ?? project.tasks_count} Done
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            In Progress: {summary?.in_progress_tasks ?? 0} · Pending: {summary?.pending_tasks ?? 0} ·
            Blocked: {summary?.blocked_tasks ?? 0} · Overdue: {summary?.overdue_tasks ?? 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Budget & Timeline</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {project.budget ? `$${Number(project.budget).toLocaleString()}` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {project.start_date || 'TBD'} → {project.planned_completion_date || 'TBD'}
          </div>
        </div>
      </div>

      {(project.objectives || project.deliverables || project.closure_remarks) && (
        <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="card">
            <h3>Objectives</h3>
            <p>{project.objectives || '—'}</p>
          </div>
          <div className="card">
            <h3>Deliverables</h3>
            <p>{project.deliverables || '—'}</p>
          </div>
          {project.closure_remarks && (
            <div className="card">
              <h3>Closure Remarks ({project.closed_at?.slice(0, 10)})</h3>
              <p>{project.closure_remarks}</p>
            </div>
          )}
        </div>
      )}

      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="card">
          <h3>
            Participating Departments ({project.project_departments.length}) · SRS §6.5 Progress
          </h3>
          {summary?.department_progress && summary.department_progress.length > 0 ? (
            summary.department_progress.map((dp) => (
              <div
                key={dp.department_id}
                style={{
                  padding: '0.55rem 0',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{dp.department_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    Tasks: {dp.completed_tasks}/{dp.total_tasks} completed
                  </div>
                </div>
                <span className="badge badge-active">{dp.progress}%</span>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No participating departments assigned yet. Click &quot;Edit Project&quot; to assign
              departments.
            </p>
          )}
        </div>

        <div className="card">
          <h3>Participating Teams ({project.project_teams.length}) · SRS §6.5 Progress</h3>
          {summary?.team_progress && summary.team_progress.length > 0 ? (
            summary.team_progress.map((tp) => (
              <div
                key={tp.team_id}
                style={{
                  padding: '0.55rem 0',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{tp.team_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    Tasks: {tp.completed_tasks}/{tp.total_tasks} completed
                  </div>
                </div>
                <span className="badge badge-active">{tp.progress}%</span>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No participating teams assigned yet. Click &quot;Edit Project&quot; to assign teams.
            </p>
          )}
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="card">
          <h3>Project Members ({project.members.length})</h3>
          {project.members.map((m) => (
            <div
              key={m.id}
              style={{
                padding: '0.55rem 0',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{m.user_full_name}</strong> ({m.user_email})
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Role: {m.role_in_project} · Status: {m.status}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleRemoveMember(m.id)}
              >
                Remove
              </button>
            </div>
          ))}

          <form
            onSubmit={handleAddMember}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr auto',
              gap: '0.5rem',
              marginTop: '0.85rem',
            }}
          >
            <select
              className="select"
              value={newMemberUser}
              onChange={(e) => setNewMemberUser(e.target.value)}
            >
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Role in project"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary">
              + Add Member
            </button>
          </form>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Phases ({project.phases.length}) & Milestones ({project.milestones.length})</h3>
            <div className="btn-row">
              <Link to={`/projects/${project.id}/planning`} className="btn btn-sm">
                Manage Phases
              </Link>
              <Link to={`/projects/${project.id}/milestones`} className="btn btn-sm">
                Manage Milestones
              </Link>
            </div>
          </div>
          {project.phases.map((ph) => (
            <div
              key={ph.id}
              style={{
                padding: '0.55rem 0',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong>Phase: {ph.name}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Owner: {ph.owner_name || 'N/A'} · {ph.start_date || 'TBD'} to {ph.end_date || 'TBD'}
                </div>
              </div>
              <span className="badge badge-in-progress">
                {ph.status} ({Number(ph.progress).toFixed(0)}%)
              </span>
            </div>
          ))}
          {project.milestones.map((ms) => (
            <div
              key={ms.id}
              style={{
                padding: '0.55rem 0',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong>Milestone: {ms.title}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Target: {ms.target_date} · Linked Tasks: {ms.milestone_tasks.length}
                </div>
              </div>
              <span className="badge badge-active">
                {ms.status} ({Number(ms.progress).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Project Tasks & Subtasks ({tasks.length})</h3>
          <Link to={`/tasks/new?project=${project.id}`} className="btn btn-sm btn-primary">
            + New Task
          </Link>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Owner</th>
              <th>Active Assignments</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {t.is_subtask ? `↳ ${t.title}` : t.title}
                  </Link>
                </td>
                <td>{t.is_subtask ? 'Subtask' : 'Task'}</td>
                <td>
                  <span className="badge badge-in-progress">{t.status}</span>
                </td>
                <td>
                  <span className="badge">{t.priority}</span>
                </td>
                <td>{t.task_owner_name || '—'}</td>
                <td>
                  {t.active_assignments
                    .map((a) => (a.assignment_type === 'User' ? a.user_name : `Team: ${a.team_name}`))
                    .join(', ') || 'None'}
                </td>
                <td>{Number(t.progress).toFixed(0)}%</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7}>No tasks created for this project yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
