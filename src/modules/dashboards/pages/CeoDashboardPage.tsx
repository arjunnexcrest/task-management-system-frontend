import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { type CeoDashboardResponse, dashboardsApi } from '@/modules/dashboards/api'

function badgeClass(value: string) {
  const v = value.toLowerCase()
  if (v.includes('active') || v.includes('completed') || v.includes('approved'))
    return 'badge badge-active'
  if (v.includes('critical') || v.includes('delayed') || v.includes('risk') || v.includes('blocked'))
    return 'badge badge-critical'
  if (v.includes('high') || v.includes('progress')) return 'badge badge-high'
  if (v.includes('medium') || v.includes('review') || v.includes('planned'))
    return 'badge badge-medium'
  return 'badge'
}

function formatCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

export function Page() {
  const [data, setData] = useState<CeoDashboardResponse | null>(null)
  const [selectedCompany, setSelectedCompany] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard(companyId = selectedCompany) {
    setLoading(true)
    setError(null)
    try {
      const res = await dashboardsApi.getCeoDashboard(companyId || undefined)
      setData(res)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Access denied (403): Only the CEO can view the Executive Dashboard.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load CEO Dashboard.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard(selectedCompany)
  }, [selectedCompany])

  if (loading && !data) {
    return (
      <div className="page-container">
        <div className="card">Loading CEO Executive Dashboard…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div
          className="card"
          style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
        >
          <h3 style={{ margin: '0 0 0.4rem' }}>Unable to load CEO Dashboard</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const kpi = data.enterprise_kpis
  const totalStatusCount = Math.max(
    1,
    data.tasks_by_status.reduce((acc, s) => acc + s.count, 0),
  )

  return (
    <div className="page-container">
      {/* Executive Header & Direct CEO Controls */}
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §10 · CEO Executive Command Center</p>
          <h1>CEO Enterprise Dashboard</h1>
          <p>
            Cross-company executive oversight, portfolio health, governance controls, and
            real-time operational drill-down.
          </p>
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <select
            className="select"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            style={{ minWidth: 210 }}
          >
            <option value="">All Companies (Enterprise)</option>
            {data.companies_filter.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <Link to="/companies" className="btn btn-primary">
            Manage Companies
          </Link>
          <Link to="/projects/new" className="btn">
            + New Project
          </Link>
          <Link to="/tasks/new" className="btn">
            + New Task
          </Link>
          <Link to="/employees" className="btn">
            Users &amp; Roles
          </Link>
        </div>
      </div>

      {/* Primary Executive KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Companies</div>
          <div className="stat-value">
            {kpi.active_companies}
            <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--muted)' }}>
              {' '}
              / {kpi.total_companies} active
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {kpi.total_departments} depts · {kpi.total_teams} teams
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Workforce</div>
          <div className="stat-value">
            {kpi.active_users}
            <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--muted)' }}>
              {' '}
              / {kpi.total_users} active
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            <Link to="/employees" style={{ color: 'var(--accent-brand)', fontWeight: 500 }}>
              Manage accounts →
            </Link>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Projects Portfolio</div>
          <div className="stat-value">
            {kpi.active_projects}
            <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--muted)' }}>
              {' '}
              / {kpi.total_projects} total
            </span>
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: kpi.at_risk_projects > 0 ? '#b91c1c' : 'var(--muted)',
              marginTop: '0.25rem',
              fontWeight: kpi.at_risk_projects > 0 ? 600 : 400,
            }}
          >
            {kpi.at_risk_projects} at risk · Avg {kpi.avg_project_progress}%
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Portfolio Budget</div>
          <div className="stat-value" style={{ fontSize: '1.38rem' }}>
            {formatCurrency(kpi.total_budget)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {kpi.completed_projects} completed project(s)
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Tasks Execution</div>
          <div className="stat-value">
            {kpi.completed_tasks}
            <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--muted)' }}>
              {' '}
              / {kpi.total_tasks} done
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {kpi.in_progress_tasks} in progress · Avg {kpi.avg_task_progress}%
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Overdue &amp; Critical</div>
          <div
            className="stat-value"
            style={{ color: kpi.overdue_tasks > 0 ? '#b91c1c' : 'var(--ink)' }}
          >
            {kpi.overdue_tasks}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {kpi.critical_overdue_tasks} critical · {kpi.due_today_tasks} due today
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-value">{kpi.pending_reviews}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {kpi.changes_requested} returned ·{' '}
            <Link to="/reviews" style={{ color: 'var(--accent-brand)', fontWeight: 500 }}>
              Open queue →
            </Link>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Blockers &amp; Risks</div>
          <div
            className="stat-value"
            style={{
              color:
                kpi.blocked_tasks + kpi.open_blockers > 0 ? '#b45309' : 'var(--ink)',
            }}
          >
            {kpi.blocked_tasks + kpi.open_blockers}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {kpi.open_risks} risks · {kpi.open_issues} open issues
          </div>
        </div>
      </div>

      {/* CEO Direct Management Hub — Full Control Across All Modules */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Executive Management Controls</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--muted)' }}>
              Full administrative access across companies, org structure, delivery, approvals, and
              system governance.
            </p>
          </div>
        </div>
        <div className="btn-row" style={{ gap: '0.6rem' }}>
          <Link to="/companies" className="btn">
            Companies ({kpi.total_companies})
          </Link>
          <Link to="/departments" className="btn">
            Departments ({kpi.total_departments})
          </Link>
          <Link to="/teams" className="btn">
            Teams ({kpi.total_teams})
          </Link>
          <Link to="/employees" className="btn">
            Employees ({kpi.total_users})
          </Link>
          <Link to="/projects" className="btn">
            Projects ({kpi.total_projects})
          </Link>
          <Link to="/tasks" className="btn">
            All Tasks ({kpi.total_tasks})
          </Link>
          <Link to="/reviews" className="btn">
            Approvals ({kpi.pending_reviews})
          </Link>
          <Link to="/workload" className="btn">
            Workload
          </Link>
          <Link to="/reports" className="btn">
            Reports
          </Link>
          <Link to="/rbac" className="btn">
            Roles &amp; Permissions
          </Link>
          <Link to="/settings" className="btn">
            System Settings
          </Link>
        </div>
      </div>

      {/* Company-by-Company Executive Drill-Down */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.9rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Company Portfolio Breakdown</h3>
          <div className="btn-row">
            {selectedCompany && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedCompany('')}
              >
                Clear Company Filter
              </button>
            )}
            <Link to="/companies" className="btn btn-sm btn-primary">
              + Create / Edit Company
            </Link>
          </div>
        </div>
        {data.company_breakdown.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No companies registered yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Org Structure</th>
                <th>Projects</th>
                <th>Tasks &amp; Completion</th>
                <th>Overdue</th>
                <th>Budget</th>
                <th>Executive Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.company_breakdown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      to={`/companies/${c.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {c.name}
                    </Link>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      {c.code} · {c.members_count} member(s)
                    </div>
                  </td>
                  <td>
                    <span className={badgeClass(c.status)}>{c.status}</span>
                  </td>
                  <td style={{ fontSize: '0.84rem' }}>
                    {c.departments_count} dept(s) · {c.teams_count} team(s)
                  </td>
                  <td>
                    <strong>{c.active_projects_count}</strong> / {c.projects_count} active
                    {c.at_risk_projects_count > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>
                        {c.at_risk_projects_count} at risk
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <div style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                      {c.completed_tasks_count}/{c.tasks_count} ({c.completion_rate}%)
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, c.completion_rate)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        c.overdue_tasks_count > 0 ? 'badge badge-critical' : 'badge'
                      }
                    >
                      {c.overdue_tasks_count}
                    </span>
                  </td>
                  <td>{formatCurrency(c.total_budget)}</td>
                  <td>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setSelectedCompany(selectedCompany === c.id ? '' : c.id)
                        }
                      >
                        {selectedCompany === c.id ? 'Show All' : 'Drill Down'}
                      </button>
                      <Link to={`/companies/${c.id}`} className="btn btn-sm">
                        Manage
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Project Health + Department Performance */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.9rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Project Portfolio Health</h3>
          <Link to="/projects" className="btn btn-sm">
            View All Projects →
          </Link>
        </div>
        {data.project_health.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No projects in the selected scope.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Company &amp; PM</th>
                <th>Status &amp; Priority</th>
                <th>Progress</th>
                <th>Tasks / Overdue</th>
                <th>Target Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.project_health.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      to={`/projects/${p.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {p.code}
                    </Link>
                    <div style={{ fontSize: '0.84rem' }}>{p.name}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{p.company_name}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      PM: {p.project_manager_name}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span className={badgeClass(p.status)}>{p.status}</span>
                      <span className={badgeClass(p.priority)}>{p.priority}</span>
                    </div>
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                      {p.progress}%
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, p.progress)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    {p.completed_tasks_count}/{p.tasks_count} done
                    {p.overdue_tasks_count > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>
                        {p.overdue_tasks_count} overdue
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.84rem' }}>{p.planned_completion_date || '—'}</td>
                  <td>
                    <div className="btn-row">
                      <Link to={`/projects/${p.id}`} className="btn btn-sm">
                        Overview
                      </Link>
                      <Link to={`/projects/${p.id}/edit`} className="btn btn-sm">
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Department Performance & Status Breakdown */}
      <div className="form-grid">
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.85rem',
            }}
          >
            <h3 style={{ margin: 0 }}>Department Performance</h3>
            <Link to="/departments" className="btn btn-sm">
              Manage →
            </Link>
          </div>
          {data.department_breakdown.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No departments found.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Head</th>
                  <th>Completion</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.department_breakdown.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {d.company_name} · {d.teams_count} team(s) · {d.members_count} member(s)
                      </div>
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{d.head_name}</td>
                    <td>
                      {d.completed_tasks_count}/{d.tasks_count} ({d.completion_rate}%)
                    </td>
                    <td>
                      <span
                        className={
                          d.overdue_tasks_count > 0 ? 'badge badge-critical' : 'badge'
                        }
                      >
                        {d.overdue_tasks_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 0.9rem' }}>Task Status Distribution</h3>
          {data.tasks_by_status.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No tasks recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {data.tasks_by_status.map((item) => {
                const pct = Math.round((item.count / totalStatusCount) * 100)
                return (
                  <div key={item.status}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.84rem',
                        marginBottom: '0.2rem',
                      }}
                    >
                      <span>{item.status}</span>
                      <strong>
                        {item.count} ({pct}%)
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pending Approvals & Overdue Escalation Watchlist */}
      <div className="form-grid">
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.85rem',
            }}
          >
            <h3 style={{ margin: 0 }}>
              Pending Approvals ({data.pending_approvals.length})
            </h3>
            <Link to="/reviews" className="btn btn-sm">
              Open Review Queue →
            </Link>
          </div>
          {data.pending_approvals.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No tasks are currently waiting for approval.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Reviewer</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_approvals.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        to={`/tasks/${item.id}`}
                        style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                      >
                        {item.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {item.project_code} · Owner: {item.owner_name}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{item.reviewer_name}</td>
                    <td>
                      <span className={badgeClass(item.priority)}>{item.priority}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.85rem',
            }}
          >
            <h3 style={{ margin: 0 }}>
              Overdue &amp; Escalation Watchlist ({data.overdue_highlights.length})
            </h3>
            <Link to="/tasks" className="btn btn-sm">
              Inspect Tasks →
            </Link>
          </div>
          {data.overdue_highlights.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No overdue tasks in the current scope.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue_highlights.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        to={`/tasks/${item.id}`}
                        style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                      >
                        {item.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {item.project_code} · Due {item.due_date}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{item.owner_name}</td>
                    <td>
                      <span className="badge badge-critical">{item.days_overdue}d late</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
