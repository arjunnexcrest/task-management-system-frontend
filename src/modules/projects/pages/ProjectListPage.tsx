import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'

function badgeClass(value: string) {
  const v = value.toLowerCase()
  if (v.includes('active') || v.includes('completed')) return 'badge badge-active'
  if (v.includes('critical') || v.includes('delayed') || v.includes('risk')) return 'badge badge-critical'
  if (v.includes('high') || v.includes('progress')) return 'badge badge-high'
  if (v.includes('medium') || v.includes('planned')) return 'badge badge-medium'
  return 'badge'
}

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [memberFilter, setMemberFilter] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    projectsApi.getLookup().then(setLookup).catch(() => {})
  }, [])

  useEffect(() => {
    loadProjects()
  }, [companyFilter, statusFilter, priorityFilter, departmentFilter, memberFilter])

  async function loadProjects() {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (companyFilter) params.company = companyFilter
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (departmentFilter) params.department = departmentFilter
      if (memberFilter) params.participating_user = memberFilter
      if (search.trim()) params.search = search.trim()
      const data = await projectsApi.listProjects(params)
      setProjects(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDeleteProject() {
    if (!projectToDelete) return
    setDeleting(true)
    try {
      await projectsApi.deleteProject(projectToDelete.id)
      setProjectToDelete(null)
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setProjectToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleArchive(project: Project) {
    try {
      await projectsApi.archiveProject(project.id)
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive project')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 4 (§6.1–§6.6) · Project Management</p>
          <h1>Enterprise Projects</h1>
          <p>
            Multi-company UUID-scoped projects, participating departments & teams, phases, milestones,
            and progress tracking.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/projects/new" className="btn btn-primary">
            + Create Project
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">{projects.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Projects</div>
          <div className="stat-value">
            {projects.filter((p) => p.status === 'Active').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical / At Risk</div>
          <div className="stat-value">
            {
              projects.filter(
                (p) => p.priority === 'Critical' || p.status === 'At Risk' || p.status === 'Delayed',
              ).length
            }
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Completion</div>
          <div className="stat-value">
            {projects.length
              ? `${Math.round(
                  projects.reduce((acc, p) => acc + Number(p.progress || 0), 0) / projects.length,
                )}%`
              : '0%'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search by project name, code, objectives..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadProjects()}
          />
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Planned">Planned</option>
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="At Risk">At Risk</option>
            <option value="Delayed">Delayed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Archived">Archived</option>
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
          <select
            className="select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {lookup?.departments
              .filter((d) => !companyFilter || d.company_id === companyFilter)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          >
            <option value="">All Participating Members</option>
            {lookup?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.designation || u.email})
              </option>
            ))}
          </select>
          <button className="btn" onClick={loadProjects}>
            Search
          </button>
        </div>

        {error && <p style={{ color: '#991b1b', marginBottom: '0.75rem' }}>{error}</p>}
        {loading ? (
          <p>Loading projects from PostgreSQL...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code & Name</th>
                <th>Company</th>
                <th>Project Manager</th>
                <th>Departments & Teams</th>
                <th>Status & Priority</th>
                <th>Tasks</th>
                <th>Progress</th>
                <th>CRUD Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>
                      <Link to={`/projects/${p.id}`} style={{ color: 'var(--accent)' }}>
                        {p.code}
                      </Link>
                    </strong>
                    <div>{p.name}</div>
                    {p.planned_completion_date && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        Target: {p.planned_completion_date}
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{p.company_name}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {p.company_code}
                    </span>
                  </td>
                  <td>
                    <div>{p.project_manager_name || 'Unassigned'}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {p.members_count ?? 0} member(s)
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>Depts:</strong>{' '}
                      {p.departments_summary && p.departments_summary.length > 0
                        ? p.departments_summary.map((d) => d.name).join(', ')
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      <strong>Teams:</strong>{' '}
                      {p.teams_summary && p.teams_summary.length > 0
                        ? p.teams_summary.map((t) => t.name).join(', ')
                        : '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className={badgeClass(p.status)}>{p.status}</span>
                      <span className={badgeClass(p.priority)}>{p.priority}</span>
                    </div>
                  </td>
                  <td>
                    {p.completed_tasks_count}/{p.tasks_count} done
                  </td>
                  <td style={{ minWidth: '125px' }}>
                    <div style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                      {Number(p.progress).toFixed(0)}%
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Number(p.progress))}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                      <Link to={`/projects/${p.id}`} className="btn btn-sm">
                        View
                      </Link>
                      <Link to={`/projects/${p.id}/team`} className="btn btn-sm">
                        Team &amp; Members
                      </Link>
                      <Link to={`/projects/${p.id}/assignments`} className="btn btn-sm">
                        PM &amp; Depts
                      </Link>
                      <Link to={`/projects/${p.id}/edit`} className="btn btn-sm">
                        Edit
                      </Link>
                      {p.status !== 'Archived' && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleArchive(p)}
                        >
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#991b1b', borderColor: '#fecaca' }}
                        onClick={() => setProjectToDelete(p)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={8}>No projects found matching your filter criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(projectToDelete)}
        title="Delete Project"
        message={
          projectToDelete
            ? `Permanently delete project "${projectToDelete.code} — ${projectToDelete.name}" and its associated tasks? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Project"
        loading={deleting}
        onConfirm={confirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  )
}
