import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type LookupData,
  type ProjectAssignmentHierarchy,
  type ProjectDetail,
  projectsApi,
} from '@/modules/projects/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [hierarchy, setHierarchy] = useState<ProjectAssignmentHierarchy | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 1. Project Manager Assignment state
  const [selectedManager, setSelectedManager] = useState('')
  const [autoActivate, setAutoActivate] = useState(true)

  // 2. Department Mapping state
  const [selectedDepts, setSelectedDepts] = useState<string[]>([])
  const [autoAddHeads, setAutoAddHeads] = useState(true)

  // 3. Team Mapping state
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [autoAddLeaders, setAutoAddLeaders] = useState(true)

  // 4. Member Assignment state
  const [newMemberUser, setNewMemberUser] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('Team Member')

  useEffect(() => {
    loadAll()
  }, [id])

  async function loadAll() {
    if (!id) return
    setLoading(true)
    try {
      const [projData, hierData, lookupData] = await Promise.all([
        projectsApi.getProject(id),
        projectsApi.getAssignmentHierarchy(id),
        projectsApi.getLookup(),
      ])
      setProject(projData)
      setHierarchy(hierData)
      setLookup(lookupData)
      setSelectedManager(projData.project_manager || '')
      setSelectedDepts(
        projData.department_ids || projData.project_departments.map((pd) => pd.department),
      )
      setSelectedTeams(projData.team_ids || projData.project_teams.map((pt) => pt.team))
      if (lookupData.users.length > 0 && !newMemberUser) {
        setNewMemberUser(lookupData.users[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project assignments')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelection(list: string[], setter: (next: string[]) => void, item: string) {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item))
    } else {
      setter([...list, item])
    }
  }

  async function handleAssignManager(e: FormEvent) {
    e.preventDefault()
    if (!project) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.assignProjectManager(project.id, {
        project_manager: selectedManager || null,
        auto_activate: autoActivate,
      })
      await loadAll()
      setSuccess('Accountable Project Manager assigned and notified (SRS §6.3 Step 4).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign Project Manager')
    }
  }

  async function handleMapDepartments(e: FormEvent) {
    e.preventDefault()
    if (!project) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.mapProjectDepartments(project.id, {
        department_ids: selectedDepts,
        replace: true,
        auto_add_heads: autoAddHeads,
      })
      await loadAll()
      setSuccess(
        'Participating departments mapped and Department Heads coordinated (SRS §6.3 Step 5).',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map departments')
    }
  }

  async function handleMapTeams(e: FormEvent) {
    e.preventDefault()
    if (!project) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.mapProjectTeams(project.id, {
        team_ids: selectedTeams,
        replace: true,
        auto_map_departments: true,
        auto_add_leaders: autoAddLeaders,
      })
      await loadAll()
      setSuccess('Participating teams mapped and Team Leaders coordinated (SRS §6.3 Step 6).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map teams')
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (!project || !newMemberUser) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.assignProjectMembers(project.id, {
        members: [{ user: newMemberUser, role_in_project: newMemberRole || 'Team Member' }],
        replace: false,
      })
      await loadAll()
      setSuccess('Project member assigned.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign member')
    }
  }

  async function handleSoftRemoveMember(memberRecordId: string) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.removeProjectMember(memberRecordId)
      await loadAll()
      setSuccess('Member marked as Removed while preserving historical membership record.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  async function handleReactivateMember(userId: string, role: string) {
    if (!project) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.assignProjectMembers(project.id, {
        members: [{ user: userId, role_in_project: role || 'Team Member' }],
      })
      await loadAll()
      setSuccess('Historical member reactivated on project.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate member')
    }
  }

  if (loading) return <p className="page-container">Loading project assignment workflow...</p>
  if (!project) return <p className="page-container">Project not found.</p>

  const companyDepts =
    lookup?.departments.filter((d) => d.company_id === project.company) || []
  const companyDeptIds = new Set(companyDepts.map((d) => d.id))
  const companyTeams =
    lookup?.teams.filter((t) => companyDeptIds.has(t.department_id)) || []

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            SRS §6.3 Project Assignment Workflow · {project.company_name} ({project.company_code})
          </p>
          <h1>
            {project.code}: {project.name} — PM &amp; Department Mapping
          </h1>
          <p>
            Assign the accountable Project Manager, map participating departments (coordinating
            Department Heads), map teams (coordinating Team Leaders), and manage project members.
          </p>
        </div>
        <div className="btn-row">
          <Link to={`/projects/${project.id}`} className="btn">
            Project Overview
          </Link>
          <Link to={`/projects/${project.id}/team`} className="btn btn-primary">
            Project Team &amp; Participation
          </Link>
          <Link to="/departments" className="btn">
            Manage Departments
          </Link>
          <Link to="/teams" className="btn">
            Manage Teams
          </Link>
          <Link to={`/tasks/new?project=${project.id}`} className="btn">
            + Assign Task
          </Link>
        </div>
      </div>

      {error && (
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
          {error}
        </div>
      )}

      {success && (
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
          {success}
        </div>
      )}

      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        {/* Step 1: Project Manager Assignment */}
        <form className="card" onSubmit={handleAssignManager}>
          <p className="eyebrow">SRS §6.3 Step 4</p>
          <h3>1. Accountable Project Manager Assignment</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
            Every active project requires an accountable Project Manager belonging to{' '}
            <strong>{project.company_name}</strong>. Reassigning preserves previous manager history.
          </p>

          <div className="form-field" style={{ marginTop: '0.75rem' }}>
            <label>Select Accountable Project Manager *</label>
            <select
              className="select"
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
            >
              <option value="">Unassigned (Draft / Planned only)</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={autoActivate}
              onChange={(e) => setAutoActivate(e.target.checked)}
            />
            <span>Automatically transition Draft/Planned project to Active status</span>
          </label>

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              Save Project Manager Assignment
            </button>
          </div>
        </form>

        {/* Step 2: Department Mapping */}
        <form className="card" onSubmit={handleMapDepartments}>
          <p className="eyebrow">SRS §6.3 Step 5 · project_departments</p>
          <h3>2. Participating Department Mapping ({selectedDepts.length})</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
            Select departments participating in this project. Department Heads are automatically
            coordinated into the project team.
          </p>

          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              maxHeight: '190px',
              overflowY: 'auto',
              marginTop: '0.75rem',
              background: '#f8fafc',
            }}
          >
            {companyDepts.map((dept) => (
              <label
                key={dept.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.35rem 0',
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontWeight: 400,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedDepts.includes(dept.id)}
                    onChange={() => toggleSelection(selectedDepts, setSelectedDepts, dept.id)}
                  />
                  <strong>{dept.name}</strong> ({dept.code})
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Head: {dept.department_head_name || 'Unassigned'}
                </span>
              </label>
            ))}
            {companyDepts.length === 0 && (
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                No departments in this company yet.
              </p>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={autoAddHeads}
              onChange={(e) => setAutoAddHeads(e.target.checked)}
            />
            <span>Automatically coordinate &amp; add Department Heads to Project Members</span>
          </label>

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              Save Department Mapping
            </button>
          </div>
        </form>
      </div>

      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        {/* Step 3: Team Mapping */}
        <form className="card" onSubmit={handleMapTeams}>
          <p className="eyebrow">SRS §6.3 Step 6 · project_teams</p>
          <h3>3. Participating Team Mapping ({selectedTeams.length})</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
            Assign department teams to execute project work. Selecting a team automatically ensures
            its parent department is mapped (DB Design §4.3).
          </p>

          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              maxHeight: '190px',
              overflowY: 'auto',
              marginTop: '0.75rem',
              background: '#f8fafc',
            }}
          >
            {companyTeams.map((tm) => (
              <label
                key={tm.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.35rem 0',
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontWeight: 400,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(tm.id)}
                    onChange={() => toggleSelection(selectedTeams, setSelectedTeams, tm.id)}
                  />
                  <strong>{tm.name}</strong> ({tm.department_name || 'Dept'})
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Leader: {tm.team_leader_name || 'Unassigned'}
                </span>
              </label>
            ))}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={autoAddLeaders}
              onChange={(e) => setAutoAddLeaders(e.target.checked)}
            />
            <span>Automatically coordinate &amp; add Team Leaders to Project Members</span>
          </label>

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              Save Team Mapping
            </button>
          </div>
        </form>

        {/* Step 4: Project Member Assignment */}
        <div className="card">
          <p className="eyebrow">SRS §6.3 Step 6 · project_members</p>
          <h3>4. Assign Individual Project Member</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
            Grant project participation and define the employee&apos;s role in this project.
          </p>

          <form onSubmit={handleAddMember} style={{ marginTop: '0.75rem' }}>
            <div className="form-field">
              <label>Employee</label>
              <select
                className="select"
                value={newMemberUser}
                onChange={(e) => setNewMemberUser(e.target.value)}
              >
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ marginTop: '0.65rem' }}>
              <label>Role in Project</label>
              <input
                className="input"
                placeholder="e.g. Lead Engineer, QA Reviewer, Designer..."
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              />
            </div>
            <div className="btn-row" style={{ marginTop: '0.85rem' }}>
              <button type="submit" className="btn btn-primary">
                + Assign to Project
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Visual SRS §6.3 Assignment Hierarchy Tree */}
      {hierarchy && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <p className="eyebrow">SRS §1.3 &amp; §6.3 Live Hierarchy</p>
          <h3>
            Project Assignment Hierarchy: {hierarchy.company.name} →{' '}
            {hierarchy.project_manager?.full_name || 'Unassigned PM'} →{' '}
            {hierarchy.participating_departments.length} Department(s)
          </h3>

          <div className="form-grid" style={{ marginTop: '0.85rem' }}>
            {hierarchy.participating_departments.map((dept) => (
              <div
                key={dept.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.4rem',
                  }}
                >
                  <strong>
                    Department: {dept.name} ({dept.code})
                  </strong>
                  <span className="badge badge-active">{dept.progress}%</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  Department Head:{' '}
                  <strong>{dept.department_head?.full_name || 'Unassigned'}</strong> · Tasks:{' '}
                  {dept.completed_tasks_count}/{dept.tasks_count}
                </div>

                <div style={{ paddingLeft: '0.75rem', borderLeft: '2px solid var(--line)' }}>
                  {dept.participating_teams.map((tm) => (
                    <div
                      key={tm.id}
                      style={{
                        padding: '0.35rem 0',
                        fontSize: '0.84rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        ↳ <strong>Team: {tm.name}</strong> (Leader:{' '}
                        {tm.team_leader?.full_name || 'Unassigned'})
                      </span>
                      <span style={{ color: 'var(--muted)' }}>
                        {tm.completed_tasks_count}/{tm.tasks_count} tasks ({tm.progress}%)
                      </span>
                    </div>
                  ))}
                  {dept.participating_teams.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      No teams mapped under this department yet.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Project Membership Roster (Active & Historical) */}
      <div className="card">
        <h3>
          Project Members &amp; Participation History ({hierarchy?.members.length || 0})
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Designation</th>
              <th>Role in Project</th>
              <th>Status</th>
              <th>Owned Tasks</th>
              <th>Joined / Left</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {hierarchy?.members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.user_full_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{m.user_email}</div>
                </td>
                <td>{m.user_designation || '—'}</td>
                <td>{m.role_in_project}</td>
                <td>
                  <span
                    className={
                      m.status === 'Active' ? 'badge badge-active' : 'badge badge-critical'
                    }
                  >
                    {m.status}
                  </span>
                </td>
                <td>{m.owned_tasks_count}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  <div>Joined: {m.joined_at?.slice(0, 10)}</div>
                  {m.left_at && (
                    <div style={{ color: '#991b1b' }}>Left: {m.left_at.slice(0, 10)}</div>
                  )}
                </td>
                <td>
                  {m.status === 'Active' ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleSoftRemoveMember(m.id)}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleReactivateMember(m.user, m.role_in_project)}
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
