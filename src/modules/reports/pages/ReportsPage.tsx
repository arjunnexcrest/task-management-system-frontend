import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import { reportsApi, type TaskReportRow } from '@/modules/reports/api'

export function Page() {
  const [rows, setRows] = useState<TaskReportRow[]>([])
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [depBlockedOnly, setDepBlockedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), projectsApi.listProjects()])
      .then(([lkp, projs]) => {
        setLookup(lkp)
        setProjects(projs)
      })
      .catch(() => null)
  }, [])

  function buildParams() {
    const params: Record<string, string> = {}
    if (companyFilter) params.company = companyFilter
    if (projectFilter) params.project = projectFilter
    if (statusFilter) params.status = statusFilter
    if (priorityFilter) params.priority = priorityFilter
    if (overdueOnly) params.overdue = 'true'
    if (depBlockedOnly) params.dependency_blocked = 'true'
    if (search.trim()) params.search = search.trim()
    return params
  }

  async function loadReport() {
    setLoading(true)
    setError(null)
    try {
      const res = await reportsApi.getTaskReport(buildParams())
      setRows(res.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [companyFilter, projectFilter, statusFilter, priorityFilter, overdueOnly, depBlockedOnly])

  async function handleExportCsv() {
    setExporting(true)
    setError(null)
    try {
      await reportsApi.downloadTaskReportCsv(buildParams())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.')
    } finally {
      setExporting(false)
    }
  }

  const overdueCount = rows.filter((r) => r.is_overdue).length
  const blockedCount = rows.filter((r) => r.is_dependency_blocked).length
  const completedCount = rows.filter((r) => r.status === 'Completed').length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §16 &amp; §27.3 · Permission-Scoped Delivery Reports</p>
          <h1>Project &amp; Task Reports</h1>
          <p>
            Analyze task completion, calendar &amp; working-day overdue severity, and dependency
            blocks across authorized companies and projects, with filtered CSV export.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={exporting}
            onClick={handleExportCsv}
          >
            {exporting ? 'Exporting CSV…' : 'Download CSV Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Matching Tasks</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue Tasks</div>
          <div className="stat-value" style={{ color: overdueCount > 0 ? '#b91c1c' : 'var(--ink)' }}>
            {overdueCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Dependency Blocked</div>
          <div className="stat-value" style={{ color: blockedCount > 0 ? '#b45309' : 'var(--ink)' }}>
            {blockedCount}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            className="input"
            placeholder="Search title or project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadReport()}
          />
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value)
              setProjectFilter('')
            }}
          >
            <option value="">All Companies</option>
            {lookup?.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <select
            className="select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects
              .filter((p) => !companyFilter || p.company === companyFilter)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="To Do">To Do</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Blocked">Blocked</option>
            <option value="In Review">In Review</option>
            <option value="Changes Requested">Changes Requested</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            <span>Overdue Only</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
            <input
              type="checkbox"
              checked={depBlockedOnly}
              onChange={(e) => setDepBlockedOnly(e.target.checked)}
            />
            <span>Dep. Blocked</span>
          </label>
          <button type="button" className="btn" onClick={loadReport}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Generating report…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No task rows match the selected filters.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project &amp; Task</th>
                <th>Owner</th>
                <th>Status &amp; Priority</th>
                <th>Progress</th>
                <th>Due / Overdue (Working Days)</th>
                <th>Dependencies</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/tasks/${r.id}`} style={{ color: 'var(--accent-brand)', fontWeight: 600 }}>
                      {r.is_subtask ? `↳ ${r.title}` : r.title}
                    </Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {r.project_code}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.84rem' }}>{r.owner || 'Unassigned'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span className="badge">{r.status}</span>
                      <span className="badge">{r.priority}</span>
                    </div>
                  </td>
                  <td>{Number(r.progress).toFixed(0)}%</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div>{r.due_date || '—'}</div>
                    {r.is_overdue && (
                      <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                        {r.days_overdue}d ({r.working_days_overdue} work d) · {r.overdue_severity}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.is_dependency_blocked ? (
                      <span className="badge badge-medium">
                        {r.blocking_prerequisites_count} blocking
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Clear</span>
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
