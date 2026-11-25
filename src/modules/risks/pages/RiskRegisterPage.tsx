import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import { type BlockerItem, type IssueItem, type RiskItem, risksApi } from '@/modules/risks/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

type Tab = 'risks' | 'issues' | 'blockers'

export function Page() {
  const [tab, setTab] = useState<Tab>('risks')
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [blockers, setBlockers] = useState<BlockerItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Quick create form state
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('High')
  const [mitigation, setMitigation] = useState('')
  const [ownerId, setOwnerId] = useState('')

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [rList, iList, bList, pList, tList, lkp] = await Promise.all([
        risksApi.listRisks(),
        risksApi.listIssues(),
        risksApi.listBlockers(),
        projectsApi.listProjects(),
        tasksApi.listTasks(),
        projectsApi.getLookup(),
      ])
      setRisks(rList)
      setIssues(iList)
      setBlockers(bList)
      setProjects(pList)
      setTasks(tList)
      setLookup(lkp)
      if (!projectId && pList.length > 0) setProjectId(pList[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load risks and blockers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleCreateRisk(e: FormEvent) {
    e.preventDefault()
    if (!projectId || !title.trim()) return
    setError(null)
    setSuccess(null)
    try {
      await risksApi.createRisk({
        project: projectId,
        title: title.trim(),
        description: description.trim() || null,
        probability: severity,
        impact: severity,
        severity,
        owner: ownerId || null,
        mitigation_plan: mitigation.trim() || null,
        status: 'Open',
      })
      setTitle('')
      setDescription('')
      setMitigation('')
      setSuccess('Project risk logged.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create risk.')
    }
  }

  async function handleCreateIssue(e: FormEvent) {
    e.preventDefault()
    if (!projectId || !title.trim()) return
    setError(null)
    setSuccess(null)
    try {
      await risksApi.createIssue({
        project: projectId,
        task: taskId || null,
        title: title.trim(),
        description: description.trim() || null,
        priority: severity,
        owner: ownerId || null,
        status: 'Open',
      })
      setTitle('')
      setDescription('')
      setTaskId('')
      setSuccess('Project issue logged.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue.')
    }
  }

  async function handleResolveBlocker(b: BlockerItem) {
    setError(null)
    try {
      await risksApi.updateBlocker(b.id, { resolution_status: 'Resolved' })
      setSuccess('Blocker marked Resolved.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve blocker.')
    }
  }

  async function handleCloseRisk(r: RiskItem) {
    try {
      await risksApi.updateRisk(r.id, { status: 'Closed' })
      setSuccess(`Risk "${r.title}" closed.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close risk.')
    }
  }

  async function handleResolveIssue(i: IssueItem) {
    try {
      await risksApi.updateIssue(i.id, { status: 'Resolved' })
      setSuccess(`Issue "${i.title}" resolved.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve issue.')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §18 &amp; §9.4 · Risks, Issues &amp; Task Blockers</p>
          <h1>Risk, Issue &amp; Blocker Register</h1>
          <p>
            Track project risks, mitigation plans, delivery issues, and live task blockers reported
            in daily progress updates.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className={tab === 'risks' ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab('risks')}
          >
            Risks ({risks.length})
          </button>
          <button
            type="button"
            className={tab === 'issues' ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab('issues')}
          >
            Issues ({issues.length})
          </button>
          <button
            type="button"
            className={tab === 'blockers' ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab('blockers')}
          >
            Task Blockers ({blockers.length})
          </button>
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

      {(tab === 'risks' || tab === 'issues') && (
        <form
          className="card"
          onSubmit={tab === 'risks' ? handleCreateRisk : handleCreateIssue}
        >
          <h3>{tab === 'risks' ? 'Log New Project Risk' : 'Log New Project Issue'}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Project *</label>
              <select
                className="select"
                required
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  setTaskId('')
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Title *</label>
              <input
                className="input"
                required
                placeholder={tab === 'risks' ? 'e.g. Third-party API rate limit risk' : 'e.g. Staging DB timeout'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>{tab === 'risks' ? 'Severity' : 'Priority'}</label>
              <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="form-field">
              <label>Owner</label>
              <select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Unassigned</option>
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            {tab === 'issues' && (
              <div className="form-field">
                <label>Related Task (optional)</label>
                <select className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                  <option value="">None</option>
                  {tasks
                    .filter((t) => !projectId || t.project === projectId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="form-field">
              <label>{tab === 'risks' ? 'Mitigation Plan' : 'Description'}</label>
              <input
                className="input"
                value={tab === 'risks' ? mitigation : description}
                onChange={(e) =>
                  tab === 'risks' ? setMitigation(e.target.value) : setDescription(e.target.value)
                }
                placeholder="Planned mitigation or details…"
              />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              {tab === 'risks' ? '+ Log Risk' : '+ Log Issue'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading register…</p>
        ) : tab === 'risks' ? (
          risks.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No project risks recorded yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Project</th>
                  <th>Severity</th>
                  <th>Owner</th>
                  <th>Mitigation</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.title}</strong></td>
                    <td>
                      <Link to={`/projects/${r.project}`} style={{ color: 'var(--accent-brand)' }}>
                        {r.project_name}
                      </Link>
                    </td>
                    <td><span className="badge badge-high">{r.severity}</span></td>
                    <td>{r.owner_name || '—'}</td>
                    <td style={{ fontSize: '0.84rem' }}>{r.mitigation_plan || '—'}</td>
                    <td><span className="badge">{r.status}</span></td>
                    <td>
                      {r.status !== 'Closed' && (
                        <button type="button" className="btn btn-sm" onClick={() => handleCloseRisk(r)}>
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : tab === 'issues' ? (
          issues.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No project issues recorded yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Project / Task</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.title}</strong>
                      {i.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{i.description}</div>
                      )}
                    </td>
                    <td>
                      <Link to={`/projects/${i.project}`} style={{ color: 'var(--accent-brand)' }}>
                        {i.project_name}
                      </Link>
                      {i.task && (
                        <div style={{ fontSize: '0.76rem' }}>
                          <Link to={`/tasks/${i.task}`} style={{ color: 'var(--accent-brand)' }}>
                            Task: {i.task_title}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td><span className="badge badge-high">{i.priority}</span></td>
                    <td>{i.owner_name || '—'}</td>
                    <td><span className="badge">{i.status}</span></td>
                    <td>
                      {i.status !== 'Resolved' && i.status !== 'Closed' && (
                        <button type="button" className="btn btn-sm" onClick={() => handleResolveIssue(i)}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : blockers.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No task blockers reported.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Blocker</th>
                <th>Impact</th>
                <th>Reported By</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockers.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/tasks/${b.task}`} style={{ color: 'var(--accent-brand)', fontWeight: 600 }}>
                      {b.task_title}
                    </Link>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{b.description}</td>
                  <td><span className="badge badge-critical">{b.impact}</span></td>
                  <td style={{ fontSize: '0.84rem' }}>{b.reported_by_name}</td>
                  <td><span className="badge">{b.resolution_status}</span></td>
                  <td>
                    {b.resolution_status !== 'Resolved' && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handleResolveBlocker(b)}>
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
