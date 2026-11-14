import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type LookupData, type ProjectDetail, projectsApi } from '@/modules/projects/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [phaseName, setPhaseName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [owner, setOwner] = useState('')

  async function refresh() {
    if (!id) return
    const [proj, lkp] = await Promise.all([projectsApi.getProject(id), projectsApi.getLookup()])
    setProject(proj)
    setLookup(lkp)
  }

  useEffect(() => {
    refresh()
  }, [id])

  async function handleAddPhase(e: FormEvent) {
    e.preventDefault()
    if (!id || !phaseName.trim()) return
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
    refresh()
  }

  if (!project) return <p>Loading project phases...</p>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">{project.code} · Planning & Phases</p>
          <h1>{project.name} — Phases</h1>
          <p>Structure project execution into sequential phases (`project_phases` table).</p>
        </div>
        <Link to={`/projects/${project.id}`} className="btn">
          Back to Project Overview
        </Link>
      </div>

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
              <option value="">Select owner...</option>
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

      <div className="card">
        <h3>Configured Phases ({project.phases.length})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Phase Name</th>
              <th>Owner</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {project.phases.map((ph) => (
              <tr key={ph.id}>
                <td>
                  <strong>{ph.name}</strong>
                </td>
                <td>{ph.owner_name || '—'}</td>
                <td>{ph.start_date || '—'}</td>
                <td>{ph.end_date || '—'}</td>
                <td>
                  <span className="badge badge-in-progress">{ph.status}</span>
                </td>
                <td>{Number(ph.progress).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
