import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type LookupData, type ProjectDetail, projectsApi } from '@/modules/projects/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [owner, setOwner] = useState('')
  const [completionCriteria, setCompletionCriteria] = useState('')

  async function refresh() {
    if (!id) return
    const [proj, lkp] = await Promise.all([projectsApi.getProject(id), projectsApi.getLookup()])
    setProject(proj)
    setLookup(lkp)
  }

  useEffect(() => {
    refresh()
  }, [id])

  async function handleAddMilestone(e: FormEvent) {
    e.preventDefault()
    if (!id || !title.trim() || !targetDate) return
    await projectsApi.createMilestone({
      project: id,
      title: title.trim(),
      target_date: targetDate,
      owner: owner || null,
      completion_criteria: completionCriteria || null,
      status: 'Pending',
      approval_required: true,
      progress: 0,
    })
    setTitle('')
    setTargetDate('')
    setCompletionCriteria('')
    refresh()
  }

  if (!project) return <p>Loading project milestones...</p>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">{project.code} · Milestones & Deliverables</p>
          <h1>{project.name} — Milestones</h1>
          <p>Track critical project milestones, target dates, linked tasks, and dependencies.</p>
        </div>
        <Link to={`/projects/${project.id}`} className="btn">
          Back to Project Overview
        </Link>
      </div>

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
              <option value="">Select owner...</option>
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
              placeholder="Acceptance criteria..."
              value={completionCriteria}
              onChange={(e) => setCompletionCriteria(e.target.value)}
            />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary">
            + Create Milestone
          </button>
        </div>
      </form>

      <div className="card">
        <h3>Milestones ({project.milestones.length})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Target Date</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Linked Tasks</th>
              <th>Prerequisites</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {project.milestones.map((ms) => (
              <tr key={ms.id}>
                <td>
                  <strong>{ms.title}</strong>
                  {ms.completion_criteria && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {ms.completion_criteria}
                    </div>
                  )}
                </td>
                <td>{ms.target_date}</td>
                <td>{ms.owner_name || '—'}</td>
                <td>
                  <span className="badge badge-active">{ms.status}</span>
                </td>
                <td>
                  {ms.milestone_tasks.map((mt) => mt.task_title).join(', ') || 'None'}
                </td>
                <td>
                  {ms.dependencies.map((d) => d.depends_on_title).join(', ') || 'None'}
                </td>
                <td>{Number(ms.progress).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
