import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import {
  type Team,
  type TeamMembershipRecord,
  organizationApi,
} from '@/modules/organization/api'

export function Page() {
  const { can } = usePermissions()
  const canManageTeams = can('can_manage_teams')
  const canManageTeamMembers = can('can_manage_team_members')
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create Team form
  const [newDept, setNewDept] = useState('')
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newLeader, setNewLeader] = useState('')

  // Inline Edit Team state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Add / Remove Team Member panel
  const [memberTeamId, setMemberTeamId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [memberIsLeader, setMemberIsLeader] = useState(false)
  const [activeTeamMembers, setActiveTeamMembers] = useState<TeamMembershipRecord[]>([])

  useEffect(() => {
    projectsApi
      .getLookup()
      .then((data) => {
        setLookup(data)
        const firstActiveDept = data.departments.find((d) => d.status === 'Active')
        if (firstActiveDept) {
          setNewDept(firstActiveDept.id)
        } else if (data.departments.length > 0) {
          setNewDept(data.departments[0].id)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load lookup data')
      })
  }, [])

  useEffect(() => {
    loadTeams()
  }, [companyFilter, deptFilter, statusFilter])

  useEffect(() => {
    if (!memberTeamId) {
      setActiveTeamMembers([])
      return
    }
    organizationApi
      .listTeamMembers(memberTeamId)
      .then(setActiveTeamMembers)
      .catch(() => setActiveTeamMembers([]))
  }, [memberTeamId])

  function getUsersForCompany(companyId: string) {
    if (!lookup) return []
    if (!companyId) return lookup.users
    return lookup.users.filter((u) => u.company_ids?.includes(companyId))
  }

  const activeLookupDepartments = useMemo(
    () => (lookup?.departments || []).filter((d) => d.status === 'Active'),
    [lookup],
  )

  const filterDepartments = useMemo(() => {
    if (!lookup) return []
    if (!companyFilter) return lookup.departments
    return lookup.departments.filter((d) => d.company_id === companyFilter)
  }, [lookup, companyFilter])

  const selectedCreateDept = useMemo(
    () => lookup?.departments.find((d) => d.id === newDept) || null,
    [lookup, newDept],
  )

  const createLeaderUsers = useMemo(
    () => (selectedCreateDept ? getUsersForCompany(selectedCreateDept.company_id) : []),
    [lookup, selectedCreateDept],
  )

  const activeTeams = useMemo(
    () => teams.filter((t) => t.status === 'Active'),
    [teams],
  )

  const selectedMemberTeam = useMemo(
    () => teams.find((t) => t.id === memberTeamId) || null,
    [teams, memberTeamId],
  )

  const memberCompanyUsers = useMemo(
    () => (selectedMemberTeam ? getUsersForCompany(selectedMemberTeam.company_id) : []),
    [lookup, selectedMemberTeam],
  )

  useEffect(() => {
    if (newLeader && !createLeaderUsers.some((u) => u.id === newLeader)) {
      setNewLeader('')
    }
  }, [createLeaderUsers, newLeader])

  useEffect(() => {
    if (memberCompanyUsers.length === 0) {
      setMemberUserId('')
    } else if (!memberCompanyUsers.some((u) => u.id === memberUserId)) {
      setMemberUserId(memberCompanyUsers[0].id)
    }
  }, [memberCompanyUsers, memberUserId])

  async function loadTeams(overrideSearch?: string) {
    setLoading(true)
    try {
      const list = await organizationApi.listTeams({
        company: companyFilter || undefined,
        department: deptFilter || undefined,
        status: statusFilter || undefined,
        search: overrideSearch !== undefined ? overrideSearch : searchQuery || undefined,
      })
      setTeams(list)
      const firstActive = list.find((t) => t.status === 'Active')
      if (firstActive && (!memberTeamId || !list.some((t) => t.id === memberTeamId))) {
        setMemberTeamId(firstActive.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  async function refreshSelectedMembers(teamId: string) {
    if (!teamId) return
    try {
      const members = await organizationApi.listTeamMembers(teamId)
      setActiveTeamMembers(members)
    } catch {
      // Ignore refresh errors
    }
  }

  async function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    await loadTeams(searchQuery)
  }

  async function handleCreateTeam(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.createTeam({
        department: newDept,
        name: newName.trim(),
        code: newCode.trim() || null,
        team_leader: newLeader || null,
      })
      setNewName('')
      setNewCode('')
      setNewLeader('')
      await loadTeams()
      setSuccess('Team created successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
    }
  }

  function startEdit(team: Team) {
    setEditingTeamId(team.id)
    setEditName(team.name)
    setEditCode(team.code || '')
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingTeamId(null)
    setEditName('')
    setEditCode('')
  }

  async function handleSaveEdit(teamId: string) {
    if (!editName.trim()) {
      setError('Team name cannot be blank.')
      return
    }
    setSavingEdit(true)
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.updateTeam(teamId, {
        name: editName.trim(),
        code: editCode.trim() || null,
      })
      setEditingTeamId(null)
      await loadTeams()
      setSuccess('Team updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleToggleStatus(team: Team) {
    setError(null)
    setSuccess(null)
    try {
      if (team.status === 'Active') {
        await organizationApi.deactivateTeam(team.id)
        setSuccess(`Team "${team.name}" deactivated (history preserved).`)
      } else {
        await organizationApi.activateTeam(team.id)
        setSuccess(`Team "${team.name}" reactivated.`)
      }
      await loadTeams()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team status')
    }
  }

  async function handleAssignLeader(teamId: string, userId: string) {
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.assignTeamLeader(teamId, userId || null)
      await loadTeams()
      if (teamId === memberTeamId) {
        await refreshSelectedMembers(teamId)
      }
      setSuccess(userId ? 'Team Leader assigned.' : 'Team Leader unassigned.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign Team Leader')
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (!memberTeamId || !memberUserId) return
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.addTeamMember(memberTeamId, memberUserId, memberIsLeader)
      setMemberIsLeader(false)
      await Promise.all([loadTeams(), refreshSelectedMembers(memberTeamId)])
      setSuccess('Member added to team.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team member')
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!memberTeamId) return
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.removeTeamMember(memberTeamId, userId)
      await Promise.all([loadTeams(), refreshSelectedMembers(memberTeamId)])
      setSuccess('Member removed from team (membership history preserved).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove team member')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 3 (§5.2) · Team Management</p>
          <h1>Department Teams &amp; Team Leaders</h1>
          <p>
            Create, edit, and deactivate department teams, assign Team Leaders from the same
            company, and manage team rosters while preserving history.
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

      {(canManageTeams || canManageTeamMembers) && (
        <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
          {canManageTeams && (
            <form className="card" onSubmit={handleCreateTeam}>
          <h3>Create Team &amp; Assign Team Leader</h3>
          <div className="form-grid" style={{ marginTop: '0.75rem' }}>
            <div className="form-field">
              <label>Active Department *</label>
              <select
                className="select"
                required
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
              >
                {activeLookupDepartments.length === 0 && (
                  <option value="">No active departments</option>
                )}
                {activeLookupDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
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
              <label>Team Leader (Company Members)</label>
              <select
                className="select"
                value={newLeader}
                onChange={(e) => setNewLeader(e.target.value)}
              >
                <option value="">Unassigned</option>
                {createLeaderUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={!newDept}>
              + Create Team
            </button>
          </div>
        </form>
          )}

          {canManageTeamMembers && (
        <form className="card" onSubmit={handleAddMember}>
          <h3>Manage Team Members (SRS §5.2)</h3>
          <div className="form-grid" style={{ marginTop: '0.75rem' }}>
            <div className="form-field">
              <label>Active Team *</label>
              <select
                className="select"
                required
                value={memberTeamId}
                onChange={(e) => setMemberTeamId(e.target.value)}
              >
                {activeTeams.length === 0 && <option value="">No active teams</option>}
                {activeTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.department_name})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Employee (Same Company) *</label>
              <select
                className="select"
                required
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
              >
                {memberCompanyUsers.length === 0 && (
                  <option value="">No active members in this company</option>
                )}
                {memberCompanyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>
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
              checked={memberIsLeader}
              onChange={(e) => setMemberIsLeader(e.target.checked)}
            />
            <span>Designate as Team Leader</span>
          </label>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!memberTeamId || !memberUserId}
            >
              + Add Member
            </button>
          </div>

          {activeTeamMembers.length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                Current Active Roster ({activeTeamMembers.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {activeTeamMembers.map((m) => (
                  <span
                    key={m.id}
                    className="badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.25rem 0.55rem',
                    }}
                  >
                    <span>
                      {m.user_full_name}
                      {m.is_leader ? ' (Leader)' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.user)}
                      title="Remove member (preserves history)"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </form>
          )}
      </div>
      )}

      <div className="card">
        <form className="filter-bar" onSubmit={handleSearchSubmit}>
          <input
            className="input"
            placeholder="Search by team name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: '220px' }}
          />
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value)
              setDeptFilter('')
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
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {filterDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button type="submit" className="btn">
            Search
          </button>
        </form>

        {loading ? (
          <p>Loading teams...</p>
        ) : teams.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0' }}>
            No teams found matching the current filters.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Department / Company</th>
                <th>Status</th>
                <th>Team Leader</th>
                <th>Members</th>
                <th>Projects</th>
                {canManageTeams && <th>Assign / Change Leader</th>}
                {canManageTeams && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const isEditing = editingTeamId === t.id
                const teamCompanyUsers = getUsersForCompany(t.company_id)
                return (
                  <tr key={t.id}>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <input
                            className="input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Team name"
                          />
                          <input
                            className="input"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            placeholder="Code (optional)"
                          />
                        </div>
                      ) : (
                        <>
                          <strong>{t.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            Code: {t.code || '—'}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      <div>{t.department_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        {t.company_name} ({t.company_code})
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === 'Active' ? 'badge-active' : 'badge-inactive'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <strong>{t.team_leader_name || 'Unassigned'}</strong>
                      {t.team_leader_email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {t.team_leader_email}
                        </div>
                      )}
                    </td>
                    <td>{t.active_members_count}</td>
                    <td>
                      <span className="badge badge-active">
                        {t.mapped_projects_count} project(s)
                      </span>
                    </td>
                    {canManageTeams && (
                      <td>
                        <select
                          className="select"
                          disabled={t.status !== 'Active'}
                          value={t.team_leader_id || ''}
                          onChange={(e) => handleAssignLeader(t.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {teamCompanyUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {canManageTeams && (
                      <td>
                        <div className="btn-row">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={savingEdit}
                                onClick={() => handleSaveEdit(t.id)}
                              >
                                Save
                              </button>
                              <button type="button" className="btn" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => startEdit(t)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleToggleStatus(t)}
                              >
                                {t.status === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
