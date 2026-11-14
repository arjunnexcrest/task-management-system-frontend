import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type LookupData,
  type OrganizationTeam,
  projectsApi,
} from '@/modules/projects/api'

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [teams, setTeams] = useState<OrganizationTeam[]>([])
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [newDept, setNewDept] = useState('')
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newLeader, setNewLeader] = useState('')

  useEffect(() => {
    projectsApi.getLookup().then((data) => {
      setLookup(data)
      if (data.departments.length > 0) {
        setNewDept(data.departments[0].id)
      }
    })
  }, [])

  useEffect(() => {
    loadTeams()
  }, [deptFilter])

  async function loadTeams() {
    setLoading(true)
    try {
      const list = await projectsApi.listTeams(deptFilter || undefined)
      setTeams(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTeam(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.createTeam({
        department: newDept,
        name: newName.trim(),
        code: newCode.trim() || undefined,
        team_leader: newLeader || null,
      })
      setNewName('')
      setNewCode('')
      await loadTeams()
      setSuccess('Team created and Team Leader assigned.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
    }
  }

  async function handleAssignLeader(teamId: string, userId: string) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.assignTeamLeader(teamId, userId || null)
      await loadTeams()
      setSuccess('Team Leader updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign Team Leader')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 3 (§5.2) · Team Management</p>
          <h1>Department Teams &amp; Team Leaders</h1>
          <p>
            Create teams under company departments, assign Team Leaders, and track participating
            projects.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/departments" className="btn">
            Manage Departments
          </Link>
          <Link to="/projects" className="btn btn-primary">
            Map to Projects
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

      <form className="card" onSubmit={handleCreateTeam} style={{ marginBottom: '1.25rem' }}>
        <h3>Create Team &amp; Assign Team Leader</h3>
        <div className="form-grid" style={{ marginTop: '0.75rem' }}>
          <div className="form-field">
            <label>Department *</label>
            <select
              className="select"
              required
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            >
              {lookup?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Team Name *</label>
            <input
              className="input"
              required
              placeholder="e.g. Platform API Team"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Team Code</label>
            <input
              className="input"
              placeholder="e.g. API-TM"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Team Leader</label>
            <select
              className="select"
              value={newLeader}
              onChange={(e) => setNewLeader(e.target.value)}
            >
              <option value="">Unassigned</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary">
            + Create Team
          </button>
        </div>
      </form>

      <div className="card">
        <div className="filter-bar">
          <select
            className="select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {lookup?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading teams...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Parent Department</th>
                <th>Company</th>
                <th>Team Leader</th>
                <th>Active Members</th>
                <th>Participating Projects</th>
                <th>Change Team Leader</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Code: {t.code || '—'}
                    </div>
                  </td>
                  <td>{t.department_name}</td>
                  <td>{t.company_name}</td>
                  <td>
                    <strong>{t.team_leader_name || 'Unassigned'}</strong>
                  </td>
                  <td>{t.active_members_count}</td>
                  <td>
                    <span className="badge badge-active">
                      {t.mapped_projects_count} project(s)
                    </span>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={t.team_leader_id || ''}
                      onChange={(e) => handleAssignLeader(t.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {lookup?.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </select>
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
