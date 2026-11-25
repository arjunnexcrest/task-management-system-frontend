import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardsApi, type RoleDashboardResponse } from '@/modules/dashboards/api'
import { ROLE_LABELS } from '@/modules/accounts/hooks/usePermissions'
import type { RoleName } from '@/types'

function badgeClass(value: string) {
  const v = value.toLowerCase()
  if (v.includes('active') || v.includes('completed') || v.includes('approved'))
    return 'badge badge-active'
  if (v.includes('critical') || v.includes('delayed') || v.includes('risk') || v.includes('blocked'))
    return 'badge badge-critical'
  if (v.includes('high') || v.includes('progress')) return 'badge badge-high'
  if (v.includes('medium') || v.includes('review') || v.includes('changes'))
    return 'badge badge-medium'
  return 'badge'
}

const ROLE_SUBTITLES: Record<RoleName, string> = {
  CEO: 'Executive leadership overview across your organization.',
  CompanyInCharge:
    'Company-wide operational control across departments, projects, staff, and approvals.',
  ProjectManager:
    'Manage your assigned projects, milestones, schedules, task assignments, and approval sign-offs.',
  DepartmentHead:
    'Oversee department teams, cross-project allocations, escalations, and department-level reviews.',
  TeamLeader:
    'Coordinate your team workload, assign and track tasks, resolve blockers, and review deliverables.',
  Employee:
    'Track your assigned tasks, update daily progress, log time, and submit completed work for review.',
}

export function Page() {
  const [data, setData] = useState<RoleDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    dashboardsApi
      .getRoleDashboard()
      .then((res) => {
        setData(res)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">Loading your workspace dashboard…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <div
          className="card"
          style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
        >
          {error || 'Unable to load role dashboard.'}
        </div>
      </div>
    )
  }

  const { role, capabilities: caps, kpis } = data
  const roleTitle = ROLE_LABELS[role] || role
  const isEmployee = role === 'Employee'

  return (
    <div className="page-container">
      {/* Role-Specific Header & Permitted Quick Actions */}
      <div className="page-header">
        <div>
          <p className="eyebrow">
            SRS §11 · {roleTitle} Dashboard · {data.scope_title}
          </p>
          <h1>
            Welcome back, {data.user.full_name}
          </h1>
          <p>{ROLE_SUBTITLES[role]}</p>
        </div>

        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          {caps.can_view_ceo_dashboard && (
            <Link to="/dashboards/ceo" className="btn btn-primary">
              Open CEO Dashboard
            </Link>
          )}
          {caps.can_create_projects && (
            <Link to="/projects/new" className="btn btn-primary">
              + New Project
            </Link>
          )}
          {caps.can_create_tasks && (
            <Link
              to="/tasks/new"
              className={caps.can_create_projects ? 'btn' : 'btn btn-primary'}
            >
              + New Task
            </Link>
          )}
          {caps.can_review_tasks && (
            <Link to="/reviews" className="btn">
              Review Queue ({kpis.pending_reviews})
            </Link>
          )}
          {caps.can_view_workload && (
            <Link to="/workload" className="btn">
              Team Workload
            </Link>
          )}
          {isEmployee && (
            <>
              <Link to="/tasks/mine" className="btn btn-primary">
                My Assignments ({data.my_tasks.length})
              </Link>
              <Link to="/kanban" className="btn">
                Kanban Board
              </Link>
              <Link to="/tracking" className="btn">
                Log Time
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Role-Tailored KPI Strip */}
      <div className="stats-grid">
        {!isEmployee && (
          <div className="stat-card">
            <div className="stat-label">
              {role === 'ProjectManager' ? 'Managed Projects' : 'Scoped Projects'}
            </div>
            <div className="stat-value">
              {kpis.active_projects}
              <span style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--muted)' }}>
                {' '}
                / {kpis.total_projects}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: kpis.at_risk_projects > 0 ? '#b91c1c' : 'var(--muted)',
                marginTop: '0.2rem',
              }}
            >
              {kpis.at_risk_projects} at risk · Avg {kpis.avg_project_progress}%
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-label">{isEmployee ? 'My Active Tasks' : 'Scoped Tasks'}</div>
          <div className="stat-value">
            {isEmployee ? data.my_tasks.length : kpis.total_tasks}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {kpis.in_progress_tasks} in progress · {kpis.completed_tasks} completed
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Overdue &amp; Due Soon</div>
          <div
            className="stat-value"
            style={{ color: kpis.overdue_tasks > 0 ? '#b91c1c' : 'var(--ink)' }}
          >
            {kpis.overdue_tasks}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {kpis.due_today_tasks} due today · {kpis.due_soon_tasks} due in 3d
          </div>
        </div>

        {caps.can_review_tasks ? (
          <div className="stat-card">
            <div className="stat-label">Pending Reviews</div>
            <div className="stat-value">{kpis.pending_reviews}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
              {kpis.changes_requested} returned ·{' '}
              <Link to="/reviews" style={{ color: 'var(--accent-brand)', fontWeight: 500 }}>
                Review →
              </Link>
            </div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-label">Awaiting / Changes Req.</div>
            <div className="stat-value">
              {kpis.pending_reviews} / {kpis.changes_requested}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
              In review · Returned for updates
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-label">Blocked Tasks</div>
          <div
            className="stat-value"
            style={{ color: kpis.blocked_tasks > 0 ? '#b45309' : 'var(--ink)' }}
          >
            {kpis.blocked_tasks}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {kpis.dependency_blocked_tasks} dependency-blocked
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">My Time Logged (7d)</div>
          <div className="stat-value">{kpis.logged_hours_7d}h</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {kpis.unread_notifications} unread alert(s)
          </div>
        </div>
      </div>

      {/* My Assigned / Owned Open Tasks — Primary workspace for Employees, useful for everyone */}
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
            My Assigned &amp; Owned Tasks ({data.my_tasks.length})
          </h3>
          <Link to="/tasks/mine" className="btn btn-sm">
            Open Full Assignment Workspace →
          </Link>
        </div>

        {data.my_tasks.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
            You currently have no open tasks assigned directly to you.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status &amp; Priority</th>
                <th>Progress</th>
                <th>Due Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.my_tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link
                      to={`/tasks/${t.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td style={{ fontSize: '0.84rem' }}>
                    {t.project_code} · {t.project_name}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span className={badgeClass(t.status)}>{t.status}</span>
                      <span className={badgeClass(t.priority)}>{t.priority}</span>
                    </div>
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <div style={{ fontSize: '0.78rem', marginBottom: '0.18rem' }}>
                      {t.progress}%
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, t.progress)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className={t.is_overdue ? 'badge badge-critical' : ''}>
                      {t.due_date || '—'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/tasks/${t.id}`} className="btn btn-sm">
                      Update / View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Leadership Panels: Review Queue + Team Workload (Hidden for Employees) */}
      {(caps.can_review_tasks || caps.can_view_workload) && (
        <div className="form-grid">
          {caps.can_review_tasks && (
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
                  Pending Approval Queue ({data.review_queue.length})
                </h3>
                <Link to="/reviews" className="btn btn-sm btn-primary">
                  Open Review Queue
                </Link>
              </div>
              {data.review_queue.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                  No tasks awaiting your review in this scope.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Owner</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.review_queue.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link
                            to={`/tasks/${item.id}`}
                            style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                          >
                            {item.title}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {item.project_code} · Reviewer: {item.reviewer_name}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.84rem' }}>{item.owner_name}</td>
                        <td>
                          <span className={badgeClass(item.priority)}>{item.priority}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {caps.can_view_workload && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.85rem',
                }}
              >
                <h3 style={{ margin: 0 }}>Team Workload Snapshot</h3>
                <Link to="/workload" className="btn btn-sm">
                  Full Workload →
                </Link>
              </div>
              {data.team_workload.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                  No team members found in this scope.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Open</th>
                      <th>Overdue</th>
                      <th>Est. Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.team_workload.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.full_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {m.designation || m.email}
                          </div>
                        </td>
                        <td>{m.open_tasks}</td>
                        <td>
                          <span
                            className={
                              m.overdue_tasks > 0 ? 'badge badge-critical' : 'badge'
                            }
                          >
                            {m.overdue_tasks}
                          </span>
                        </td>
                        <td>{m.estimated_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Projects & Upcoming Deadlines */}
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
              {isEmployee ? 'My Participating Projects' : 'Projects in Your Scope'} (
              {data.projects.length})
            </h3>
            <Link to="/projects" className="btn btn-sm">
              View All →
            </Link>
          </div>
          {data.projects.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No projects assigned in your scope yet.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        to={`/projects/${p.id}`}
                        style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                      >
                        {p.code} · {p.name}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        PM: {p.project_manager_name}
                        {p.planned_completion_date ? ` · Due ${p.planned_completion_date}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className={badgeClass(p.status)}>{p.status}</span>
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <div style={{ fontSize: '0.78rem', marginBottom: '0.15rem' }}>
                        {p.progress}%
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.min(100, p.progress)}%` }}
                        />
                      </div>
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
              Upcoming Deadlines &amp; Overdue ({data.upcoming_deadlines.length})
            </h3>
            <Link to="/calendar" className="btn btn-sm">
              Calendar →
            </Link>
          </div>
          {data.upcoming_deadlines.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No deadlines within the next 7 days.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Due</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming_deadlines.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        to={`/tasks/${d.id}`}
                        style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                      >
                        {d.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {d.project_code} · {d.owner_name}
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          d.days_until_due !== null && d.days_until_due < 0
                            ? 'badge badge-critical'
                            : d.days_until_due === 0
                              ? 'badge badge-medium'
                              : 'badge'
                        }
                      >
                        {d.due_date}
                      </span>
                    </td>
                    <td>
                      <span className={badgeClass(d.priority)}>{d.priority}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Progress Updates */}
      {data.recent_updates.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.85rem' }}>Recent Progress Updates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {data.recent_updates.map((u) => (
              <div
                key={u.id}
                style={{
                  padding: '0.7rem 0.9rem',
                  border: '1px solid var(--line)',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <Link
                    to={`/tasks/${u.task_id}`}
                    style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                  >
                    {u.task_title}
                  </Link>
                  <span className="badge badge-active">{u.progress_percent}%</span>
                </div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.2rem', color: 'var(--ink)' }}>
                  {u.work_completed}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.18rem' }}>
                  {u.author_name} · {u.created_at.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
