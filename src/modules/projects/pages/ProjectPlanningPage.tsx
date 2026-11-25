import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import {
  type LookupData,
  type ProjectDetail,
  type ProjectPhase,
  projectsApi,
} from '@/modules/projects/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermissions()
  const canEditProjects = can('can_edit_projects')

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [phaseName, setPhaseName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [owner, setOwner] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [phaseToDelete, setPhaseToDelete] = useState<ProjectPhase | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    if (!id) return
    const [proj, lkp] = await Promise.all([projectsApi.getProject(id), projectsApi.getLookup()])
    setProject(proj)
    setLookup(lkp)
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load phases'))
  }, [id])

  async function handleAddPhase(e: FormEvent) {
    e.preventDefault()
    if (!id || !phaseName.trim()) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.createPhase({
        project: id,
        name: phaseName.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        owner: owner || null,
        status: 'Not Started',
        progress: 0,
      })
      setPhaseName('')
      setStartDate('')
      setEndDate('')
      setOwner('')
      setSuccess('Project phase created.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create phase')
    }
  }

  async function handleStatusChange(phase: ProjectPhase, nextStatus: ProjectPhase['status']) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.updatePhase(phase.id, {
        status: nextStatus,
        ...(nextStatus === 'Completed' ? { progress: 100 } : {}),
      })
      setSuccess(`Phase "${phase.name}" updated to ${nextStatus}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update phase')
    }
  }

  async function confirmDeletePhase() {
    if (!phaseToDelete) return
    setDeleting(true)
    setError(null)
    try {
      await projectsApi.deletePhase(phaseToDelete.id)
      setSuccess(`Phase "${phaseToDelete.name}" deleted.`)
      setPhaseToDelete(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete phase')
      setPhaseToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!project) return <div className="page-container"><div className="card">Loading project phases…</div></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">{project.code} · SRS §6.4 Planning &amp; Phases</p>
          <h1>{project.name} — Phases</h1>
          <p>Structure project execution into sequential phases with automatic task progress rollup.</p>
        </div>
        <div className="btn-row">
          <Link to={`/projects/${project.id}/milestones`} className="btn">
            Milestones
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
        <form className="card" onSubmit={handleAddPhase}>
          <h3>Add New Project Phase</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Phase Name *</label>
              <input
                className="input"
                required
                placeholder="e.g. Phase 3: UAT & Deployment"
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Phase Owner</label>
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
              <label>Start Date</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>End Date</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              + Add Phase
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <h3>Configured Phases ({project.phases.length})</h3>
        {project.phases.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No phases configured for this project yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Phase Name</th>
                <th>Owner</th>
                <th>Schedule</th>
                <th>Tasks</th>
                <th>Status</th>
                <th>Progress</th>
                {canEditProjects && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {project.phases.map((ph) => (
                <tr key={ph.id}>
                  <td>
                    <strong>{ph.name}</strong>
                  </td>
                  <td>{ph.owner_name || '—'}</td>
                  <td style={{ fontSize: '0.84rem' }}>
                    {ph.start_date || 'TBD'} → {ph.end_date || 'TBD'}
                  </td>
                  <td>
                    {ph.completed_tasks_count ?? 0}/{ph.tasks_count ?? 0} done
                  </td>
                  <td>
                    {canEditProjects ? (
                      <select
                        className="select"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.82rem' }}
                        value={ph.status}
                        onChange={(e) =>
                          handleStatusChange(ph, e.target.value as ProjectPhase['status'])
                        }
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    ) : (
                      <span
                        className={`badge ${
                          ph.status === 'Completed' ? 'badge-active' : 'badge-medium'
                        }`}
                      >
                        {ph.status}
                      </span>
                    )}
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <div style={{ fontSize: '0.78rem', marginBottom: '0.18rem' }}>
                      {Number(ph.progress).toFixed(0)}%
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Number(ph.progress))}%` }}
                      />
                    </div>
                  </td>
                  {canEditProjects && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#991b1b', borderColor: '#fecaca' }}
                        onClick={() => setPhaseToDelete(ph)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(phaseToDelete)}
        title="Delete Project Phase"
        message={
          phaseToDelete
            ? `Delete phase "${phaseToDelete.name}"? Tasks assigned to this phase will remain in the project unlinked from a phase.`
            : ''
        }
        confirmLabel="Delete Phase"
        loading={deleting}
        onConfirm={confirmDeletePhase}
        onCancel={() => setPhaseToDelete(null)}
      />
    </div>
  )
}
