import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type LookupData,
  type ProjectAssignmentHierarchy,
  type ProjectDetail,
  projectsApi,
} from '@/modules/projects/api'

const PROJECT_ROLES = [
  'Team Member',
  'Lead Engineer',
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'UI/UX Designer',
  'QA / Reviewer',
  'Project Coordinator',
  'Business Analyst',
  'DevOps Engineer',
  'Team Leader',
  'Department Head',
  'Viewer / Collaborator',
]

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [participation, setParticipation] = useState<ProjectAssignmentHierarchy | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Team Mapping state
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [autoAddLeaders, setAutoAddLeaders] = useState(true)
  const [autoAddTeamMembers, setAutoAddTeamMembers] = useState(true)

  // Individual / Bulk Member Assignment state
  const [filterDeptForAdd, setFilterDeptForAdd] = useState('')
  const [filterTeamForAdd, setFilterTeamForAdd] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [newMemberRole, setNewMemberRole] = useState('Software Engineer')
  const [customRole, setCustomRole] = useState('')

  // Roster Table Filters & Inline Role Edits
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'ALL' | 'Active' | 'Removed'>('ALL')
  const [rosterSearch, setRosterSearch] = useState('')
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({})

  useEffect(() => {
    loadAll()
  }, [id])

  async function loadAll() {
    if (!id) return
    setLoading(true)
    try {
      const [projData, partData, lookupData] = await Promise.all([
        projectsApi.getProject(id),
        projectsApi.getProjectParticipation(id),
        projectsApi.getLookup(),
      ])
      setProject(projData)
      setParticipation(partData)
      setLookup(lookupData)
      setSelectedTeams(projData.team_ids || projData.project_teams.map((pt) => pt.team))

      const initialEdits: Record<string, string> = {}
      partData.members.forEach((m) => {
        initialEdits[m.id] = m.role_in_project || 'Team Member'
      })
      setRoleEdits(initialEdits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project participation data')
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

  async function handleSaveTeamMapping(e: FormEvent) {
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
        auto_add_team_members: autoAddTeamMembers,
      })
      await loadAll()
      setSuccess(
        autoAddTeamMembers
          ? 'Participating teams mapped and all active team members enrolled into project participation.'
          : 'Participating teams mapped and Team Leaders coordinated.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map teams')
    }
  }

  async function handleSyncTeamMembers(teamId?: string, teamName?: string) {
    if (!project) return
    setError(null)
    setSuccess(null)
    try {
      const res = await projectsApi.syncProjectTeamMembers(
        project.id,
        teamId ? { team_id: teamId } : {},
      )
      await loadAll()
      const synced = res.sync_result?.synced_count ?? 0
      const added = res.sync_result?.newly_added_count ?? 0
      const reactivated = res.sync_result?.reactivated_count ?? 0
      setSuccess(
        teamName
          ? `Synced ${synced} member(s) from team "${teamName}" (${added} newly added, ${reactivated} reactivated).`
          : `Synced ${synced} member(s) across all participating teams (${added} newly added, ${reactivated} reactivated).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync team members')
    }
  }

  async function handleAssignSelectedMembers(e: FormEvent) {
    e.preventDefault()
    if (!project || selectedUserIds.length === 0) {
      setError('Please select at least one employee to assign to the project.')
      return
    }
    setError(null)
    setSuccess(null)
    const effectiveRole = (customRole.trim() || newMemberRole || 'Team Member').trim()
    try {
      await projectsApi.assignProjectMembers(project.id, {
        members: selectedUserIds.map((uid) => ({
          user: uid,
          role_in_project: effectiveRole,
        })),
        replace: false,
      })
      setSelectedUserIds([])
      setCustomRole('')
      await loadAll()
      setSuccess(
        `Assigned ${selectedUserIds.length} member(s) to project with role "${effectiveRole}".`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign project members')
    }
  }

  async function handleQuickEnrollSingleUser(userId: string, role: string, fullName: string) {
    if (!project) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.assignProjectMembers(project.id, {
        members: [{ user: userId, role_in_project: role }],
        replace: false,
      })
      await loadAll()
      setSuccess(`Enrolled ${fullName} in project as "${role}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll member')
    }
  }

  async function handleUpdateMemberRole(memberRecordId: string, fullName: string) {
    const newRole = (roleEdits[memberRecordId] || '').trim()
    if (!newRole) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.updateProjectMember(memberRecordId, {
        role_in_project: newRole,
      })
      await loadAll()
      setSuccess(`Updated project role for ${fullName} to "${newRole}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member role')
    }
  }

  async function handleSoftRemoveMember(memberRecordId: string, fullName: string) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.removeProjectMember(memberRecordId)
      await loadAll()
      setSuccess(
        `Removed ${fullName} from active participation (historical record preserved with Left timestamp).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  async function handleReactivateMember(memberRecordId: string, fullName: string) {
    setError(null)
    setSuccess(null)
    const editedRole = roleEdits[memberRecordId]
    try {
      await projectsApi.reactivateProjectMember(memberRecordId, editedRole)
      await loadAll()
      setSuccess(`Reactivated ${fullName} on this project.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate member')
    }
  }

  if (loading) return <p className="page-container">Loading project team &amp; participation...</p>
  if (!project || !participation) return <p className="page-container">Project not found.</p>

  const companyDepts =
    lookup?.departments.filter((d) => d.company_id === project.company) || []
  const companyDeptIds = new Set(companyDepts.map((d) => d.id))
  const companyTeams =
    lookup?.teams.filter((t) => companyDeptIds.has(t.department_id)) || []

  // Filter candidate users for assignment by company, optional department, and optional team
  const candidateUsers = (lookup?.users || []).filter((u) => {
    if (u.company_ids && u.company_ids.length > 0 && !u.company_ids.includes(project.company)) {
      return false
    }
    if (filterDeptForAdd && !(u.department_ids || []).includes(filterDeptForAdd)) {
      return false
    }
    if (filterTeamForAdd && !(u.team_ids || []).includes(filterTeamForAdd)) {
      return false
    }
    return true
  })

  const activeMemberIds = new Set(
    participation.members.filter((m) => m.status === 'Active').map((m) => m.user),
  )

  const filteredRoster = participation.members.filter((m) => {
    if (rosterStatusFilter !== 'ALL' && m.status !== rosterStatusFilter) {
      return false
    }
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase()
      const matchName = m.user_full_name.toLowerCase().includes(q)
      const matchEmail = m.user_email.toLowerCase().includes(q)
      const matchRole = (m.role_in_project || '').toLowerCase().includes(q)
      const matchDept = (m.department_name || '').toLowerCase().includes(q)
      const matchTeam = (m.teams || []).some((t) => t.team_name.toLowerCase().includes(q))
      if (!matchName && !matchEmail && !matchRole && !matchDept && !matchTeam) {
        return false
      }
    }
    return true
  })

  const allParticipatingTeams =
    participation.participating_teams ||
    participation.participating_departments.flatMap((d) => d.participating_teams)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            SRS §5.2, §6.3 Step 6 &amp; §25.C Screen 21 · {project.company_name} (
            {project.company_code})
          </p>
          <h1>
            {project.code}: {project.name} — Project Team &amp; Participation
          </h1>
          <p>
            Assign participating teams, onboard team rosters, manage individual &amp; bulk member
            roles, track member task workloads, and view multi-project participation.
          </p>
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <Link to={`/projects/${project.id}`} className="btn">
            Project Overview
          </Link>
          <Link to={`/projects/${project.id}/assignments`} className="btn">
            PM &amp; Dept Mapping
          </Link>
          <Link to="/teams" className="btn">
            Organization Teams
          </Link>
          <Link to={`/tasks/new?project=${project.id}`} className="btn btn-primary">
            + Assign Task
          </Link>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="card">
          <p className="eyebrow">Active Participants</p>
          <h2>{participation.summary?.active_members_count ?? activeMemberIds.size}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Authorized project members (`status=Active`)
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Participating Teams</p>
          <h2>{allParticipatingTeams.length}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Mapped in `project_teams`
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Participating Departments</p>
          <h2>{participation.participating_departments.length}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Mapped in `project_departments`
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Historical / Removed</p>
          <h2>{participation.summary?.historical_members_count ?? 0}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Preserved in `project_members` history
          </p>
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

      {/* Top Grid: Team Assignment vs Individual/Bulk Member Assignment */}
      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        {/* Left Card: Participating Team Assignment & Roster Sync */}
        <form className="card" onSubmit={handleSaveTeamMapping}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="eyebrow">SRS §5.2 &amp; §6.3 Step 6 · project_teams</p>
              <h3>1. Assign Participating Teams ({selectedTeams.length})</h3>
            </div>
            {allParticipatingTeams.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleSyncTeamMembers()}
              >
                Sync All Team Rosters
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
            Select department teams executing work on this project. Mapping a team automatically
            ensures its parent department is mapped and coordinates Team Leaders &amp; Members.
          </p>

          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              maxHeight: '220px',
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
                  padding: '0.4rem 0',
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
                  <span>
                    <strong>{tm.name}</strong> ({tm.code || 'TEAM'}) ·{' '}
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {tm.department_name}
                    </span>
                  </span>
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Leader: {tm.team_leader_name || 'Unassigned'} · {tm.active_members_count ?? 0}{' '}
                  member(s)
                </span>
              </label>
            ))}
            {companyTeams.length === 0 && (
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                No teams found for this company.
              </p>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.86rem',
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

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.45rem',
              fontSize: '0.86rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={autoAddTeamMembers}
              onChange={(e) => setAutoAddTeamMembers(e.target.checked)}
            />
            <span>
              Automatically enroll all active members of selected teams into Project Participation
            </span>
          </label>

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              Save Participating Teams
            </button>
          </div>
        </form>

        {/* Right Card: Individual & Bulk Project Member Assignment */}
        <form className="card" onSubmit={handleAssignSelectedMembers}>
          <p className="eyebrow">SRS §6.1 &amp; §6.3 Step 6 · project_members</p>
          <h3>2. Assign Project Members ({selectedUserIds.length} selected)</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
            Filter company employees by department or team, select one or multiple employees, and
            assign their project participation role.
          </p>

          <div className="form-grid" style={{ marginTop: '0.65rem', gap: '0.65rem' }}>
            <div className="form-field">
              <label>Filter by Department</label>
              <select
                className="select"
                value={filterDeptForAdd}
                onChange={(e) => {
                  setFilterDeptForAdd(e.target.value)
                  setFilterTeamForAdd('')
                }}
              >
                <option value="">All Company Departments</option>
                {companyDepts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Filter by Team</label>
              <select
                className="select"
                value={filterTeamForAdd}
                onChange={(e) => setFilterTeamForAdd(e.target.value)}
              >
                <option value="">All Teams</option>
                {companyTeams
                  .filter((t) => !filterDeptForAdd || t.department_id === filterDeptForAdd)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.department_name})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: '0.5rem',
              padding: '0.65rem',
              maxHeight: '165px',
              overflowY: 'auto',
              marginTop: '0.65rem',
              background: '#f8fafc',
            }}
          >
            {candidateUsers.map((u) => {
              const isAlreadyActive = activeMemberIds.has(u.id)
              return (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.32rem 0',
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() =>
                        toggleSelection(selectedUserIds, setSelectedUserIds, u.id)
                      }
                    />
                    <span>
                      <strong>{u.full_name}</strong>{' '}
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        ({u.designation || u.email})
                      </span>
                    </span>
                  </span>
                  <span style={{ fontSize: '0.76rem' }}>
                    {isAlreadyActive ? (
                      <span className="badge badge-active">Active Member</span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>
                        {(u.team_names || []).join(', ') ||
                          (u.department_names || []).join(', ') ||
                          'Available'}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
            {candidateUsers.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                No employees match the selected department/team filter.
              </p>
            )}
          </div>

          <div className="form-grid" style={{ marginTop: '0.65rem', gap: '0.65rem' }}>
            <div className="form-field">
              <label>Standard Project Role</label>
              <select
                className="select"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              >
                {PROJECT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Or Custom Role Title</label>
              <input
                className="input"
                placeholder="Optional custom role..."
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              />
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: '0.85rem' }}>
            <button type="submit" className="btn btn-primary">
              + Assign Selected Member(s) to Project
            </button>
            { candidateUsers.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedUserIds(candidateUsers.map((u) => u.id))}
              >
                Select All Filtered ({candidateUsers.length})
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Participating Teams & Team Roster Breakdown */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow">SRS §5.2 &amp; §6.5 Team-Wise Participation &amp; Workload</p>
            <h3>Participating Teams &amp; Team Member Rosters ({allParticipatingTeams.length})</h3>
          </div>
        </div>

        {allParticipatingTeams.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            No teams are currently mapped to this project. Select teams in Card #1 above to assign
            them.
          </p>
        ) : (
          <div className="form-grid" style={{ marginTop: '0.85rem' }}>
            {allParticipatingTeams.map((tm) => (
              <div
                key={tm.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '1rem' }}>
                      {tm.name} ({tm.code || 'TEAM'})
                    </strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      Department: <strong>{tm.department_name}</strong> · Team Leader:{' '}
                      <strong>{tm.team_leader?.full_name || 'Unassigned'}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span className="badge badge-active">{tm.progress}% Done</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleSyncTeamMembers(tm.team_id, tm.name)}
                    >
                      Sync Team to Project
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    fontSize: '0.8rem',
                    color: 'var(--muted)',
                    marginBottom: '0.65rem',
                  }}
                >
                  <span>
                    Tasks: <strong>{tm.completed_tasks_count}</strong> / {tm.tasks_count} completed
                  </span>
                  <span>
                    In Progress: <strong>{tm.in_progress_tasks_count ?? 0}</strong>
                  </span>
                  <span>
                    Overdue:{' '}
                    <strong style={{ color: (tm.overdue_tasks_count ?? 0) > 0 ? '#991b1b' : undefined }}>
                      {tm.overdue_tasks_count ?? 0}
                    </strong>
                  </span>
                  <span>
                    Participating:{' '}
                    <strong>
                      {tm.participating_members_count ?? 0} / {tm.active_team_members_count}
                    </strong>{' '}
                    members
                  </span>
                </div>

                {/* Team Roster list */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--line)',
                    borderRadius: '0.4rem',
                    padding: '0.5rem 0.75rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Team Roster ({tm.team_members?.length || 0})
                  </div>
                  {(tm.team_members || []).map((rm) => (
                    <div
                      key={rm.user_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.3rem 0',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.83rem',
                      }}
                    >
                      <div>
                        <strong>{rm.full_name}</strong>{' '}
                        {rm.is_leader && (
                          <span className="badge badge-active" style={{ marginLeft: '0.25rem' }}>
                            Team Leader
                          </span>
                        )}
                        <span style={{ color: 'var(--muted)', marginLeft: '0.35rem' }}>
                          {rm.designation || rm.email}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                          {rm.assigned_tasks_count} task(s)
                        </span>
                        {rm.is_project_member ? (
                          <span className="badge badge-active">
                            {rm.role_in_project || 'Participating'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() =>
                              handleQuickEnrollSingleUser(
                                rm.user_id,
                                rm.is_leader
                                  ? `Team Leader (${tm.name})`
                                  : `Team Member (${tm.name})`,
                                rm.full_name,
                              )
                            }
                          >
                            + Enroll
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!tm.team_members || tm.team_members.length === 0) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      No active members in this team yet.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Interactive Project Participation Roster */}
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
            <p className="eyebrow">
              DB Design §4.3 project_members · Controls Project Participation &amp; Access
            </p>
            <h3>
              Project Participation Roster &amp; Workload ({filteredRoster.length} of{' '}
              {participation.members.length})
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ width: '220px' }}
              placeholder="Search member, role, dept, team..."
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
            />
            <select
              className="select"
              style={{ width: '170px' }}
              value={rosterStatusFilter}
              onChange={(e) =>
                setRosterStatusFilter(e.target.value as 'ALL' | 'Active' | 'Removed')
              }
            >
              <option value="ALL">All Statuses ({participation.members.length})</option>
              <option value="Active">
                Active Only ({participation.summary?.active_members_count ?? 0})
              </option>
              <option value="Removed">
                Removed / History ({participation.summary?.historical_members_count ?? 0})
              </option>
            </select>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department &amp; Team(s)</th>
              <th>Role in Project (Editable)</th>
              <th>Status</th>
              <th>Project Workload</th>
              <th>Multi-Project Participation</th>
              <th>Joined / Left</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoster.map((m) => {
              const isAccountablePm =
                m.is_project_manager || project.project_manager === m.user
              const currentRoleEdit = roleEdits[m.id] ?? m.role_in_project
              const roleChanged = currentRoleEdit.trim() !== (m.role_in_project || '').trim()

              return (
                <tr key={m.id}>
                  <td>
                    <div>
                      <strong>{m.user_full_name}</strong>
                      {isAccountablePm && (
                        <span
                          className="badge badge-active"
                          style={{ marginLeft: '0.35rem', fontSize: '0.72rem' }}
                        >
                          Accountable PM
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {m.user_designation || 'Employee'} · {m.user_email}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div>
                      <strong>Dept:</strong> {m.department_name || '—'}
                    </div>
                    <div style={{ color: 'var(--muted)' }}>
                      <strong>Teams:</strong>{' '}
                      {m.teams && m.teams.length > 0
                        ? m.teams.map((t) => t.team_name).join(', ')
                        : '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        className="input"
                        style={{ minWidth: '155px', padding: '0.3rem 0.5rem', fontSize: '0.83rem' }}
                        value={currentRoleEdit}
                        onChange={(e) =>
                          setRoleEdits({ ...roleEdits, [m.id]: e.target.value })
                        }
                      />
                      {roleChanged && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleUpdateMemberRole(m.id, m.user_full_name)}
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        m.status === 'Active' ? 'badge badge-active' : 'badge badge-critical'
                      }
                    >
                      {m.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <div>
                      Assigned: <strong>{m.assigned_tasks_count ?? m.owned_tasks_count}</strong> ·
                      Owned: <strong>{m.owned_tasks_count}</strong>
                    </div>
                    <div style={{ color: 'var(--muted)' }}>
                      Done: {m.completed_tasks_count ?? 0} · Overdue:{' '}
                      <span
                        style={{
                          color: (m.overdue_tasks_count ?? 0) > 0 ? '#991b1b' : undefined,
                          fontWeight: (m.overdue_tasks_count ?? 0) > 0 ? 600 : undefined,
                        }}
                      >
                        {m.overdue_tasks_count ?? 0}
                      </span>{' '}
                      · {m.estimated_effort_hours ?? 0}h
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {m.other_active_projects && m.other_active_projects.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {m.other_active_projects.map((op) => (
                          <Link
                            key={op.project_id}
                            to={`/projects/${op.project_id}/team`}
                            className="badge"
                            style={{ textDecoration: 'none', fontSize: '0.74rem' }}
                            title={`${op.name} (${op.role_in_project})`}
                          >
                            {op.code}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>Only this project</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>
                    <div>Joined: {m.joined_at?.slice(0, 10)}</div>
                    {m.left_at && (
                      <div style={{ color: '#991b1b' }}>Left: {m.left_at.slice(0, 10)}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {m.status === 'Active' ? (
                        isAccountablePm && project.status === 'Active' ? (
                          <span
                            style={{ fontSize: '0.75rem', color: 'var(--muted)' }}
                            title="Reassign the Project Manager before removing the accountable PM of an Active project."
                          >
                            Protected (PM)
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleSoftRemoveMember(m.id, m.user_full_name)}
                          >
                            Remove
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleReactivateMember(m.id, m.user_full_name)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredRoster.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  No project members match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
