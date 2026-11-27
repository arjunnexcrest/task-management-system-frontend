import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { projectsApi, type LookupData } from '@/modules/projects/api'
import {
  organizationApi,
  type HierarchyEmployeeDetail,
  type OrgCompanyNode,
  type OrgDepartmentNode,
  type OrgEmployeeNode,
  type OrgTeamNode,
  type OrganizationHierarchyResponse,
} from '@/modules/organization/api'
import { ApiError } from '@/api/client'

type ChartMode = 'visual' | 'compact' | 'structure'

const ROLE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  CEO: { border: '#1d4ed8', bg: '#eff6ff', text: '#1e3a8a' },
  CompanyInCharge: { border: '#7c3aed', bg: '#f5f3ff', text: '#5b21b6' },
  ProjectManager: { border: '#0f766e', bg: '#f0fdfa', text: '#115e59' },
  DepartmentHead: { border: '#b45309', bg: '#fffbeb', text: '#92400e' },
  TeamLeader: { border: '#0369a1', bg: '#f0f9ff', text: '#075985' },
  Employee: { border: '#64748b', bg: '#f8fafc', text: '#334155' },
}

function getRoleStyle(role?: string) {
  if (!role) return ROLE_COLORS.Employee
  return ROLE_COLORS[role] || ROLE_COLORS.Employee
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    const body = err.body as Record<string, unknown>
    if (typeof body.detail === 'string') return body.detail
    const fieldMsgs = Object.entries(body)
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
        if (typeof v === 'string') return `${k}: ${v}`
        return null
      })
      .filter(Boolean)
    if (fieldMsgs.length > 0) return fieldMsgs.join(' | ')
  }
  return err instanceof Error ? err.message : fallback
}

function collectAllReportingIds(nodes: OrgEmployeeNode[], acc = new Set<string>()): Set<string> {
  for (const n of nodes) {
    acc.add(n.id)
    if (n.children && n.children.length > 0) {
      collectAllReportingIds(n.children, acc)
    }
  }
  return acc
}

function collectAllStructureIds(companies: OrgCompanyNode[]): Set<string> {
  const acc = new Set<string>()
  for (const c of companies) {
    acc.add(`co:${c.id}`)
    for (const d of c.departments) {
      acc.add(`dept:${d.id}`)
      for (const t of d.teams) {
        acc.add(`team:${t.id}`)
      }
    }
  }
  return acc
}

interface VisualOrgNodeProps {
  node: OrgEmployeeNode
  collapsed: Set<string>
  selectedEmployeeId: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

function VisualOrgBranch({
  node,
  collapsed,
  selectedEmployeeId,
  onToggle,
  onSelect,
}: VisualOrgNodeProps) {
  const kids = node.children ?? []
  const isCollapsed = collapsed.has(node.id)
  const isSelected = selectedEmployeeId === node.id
  const roleStyle = getRoleStyle(node.role)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <div
        onClick={() => onSelect(node.id)}
        style={{
          minWidth: 215,
          maxWidth: 250,
          padding: '0.7rem 0.85rem',
          borderRadius: '0.65rem',
          border: isSelected
            ? `2px solid ${roleStyle.border}`
            : node.matched
              ? '2px solid #d97706'
              : '1px solid #cbd5e1',
          borderTop: `4px solid ${roleStyle.border}`,
          background: node.matched ? '#fffbeb' : isSelected ? roleStyle.bg : '#ffffff',
          boxShadow: isSelected
            ? '0 6px 16px rgba(15, 23, 42, 0.12)'
            : '0 2px 6px rgba(15, 23, 42, 0.05)',
          cursor: 'pointer',
          transition: 'box-shadow 0.15s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.4rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
            {node.full_name}
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.12rem 0.45rem',
              borderRadius: '999px',
              background: roleStyle.bg,
              color: roleStyle.text,
              border: `1px solid ${roleStyle.border}40`,
              whiteSpace: 'nowrap',
            }}
          >
            {node.role}
          </span>
        </div>

        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
          {node.designation || node.email}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
          {node.company_code}
          {node.departments.length > 0 ? ` · ${node.departments[0]}` : ''}
          {node.teams.length > 0 ? ` · ${node.teams[0]}` : ''}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.35rem',
            marginTop: '0.5rem',
            fontSize: '0.7rem',
          }}
        >
          <span className="badge" style={{ fontSize: '0.68rem' }}>
            {node.projects_count} proj
          </span>
          <span className="badge" style={{ fontSize: '0.68rem' }}>
            {node.active_tasks_count} tasks
          </span>
          {node.overdue_tasks_count > 0 && (
            <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
              {node.overdue_tasks_count} overdue
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.55rem',
            paddingTop: '0.45rem',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <Link
            to={`/employees/${node.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 600 }}
          >
            Profile →
          </Link>
          {kids.length > 0 ? (
            <button
              type="button"
              className="btn btn-sm"
              style={{ padding: '0.1rem 0.45rem', fontSize: '0.72rem' }}
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.id)
              }}
            >
              {isCollapsed ? `+ ${kids.length} report(s)` : `− ${kids.length}`}
            </button>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>0 reports</span>
          )}
        </div>
      </div>

      {kids.length > 0 && !isCollapsed && (
        <>
          <div style={{ width: 2, height: 18, background: '#cbd5e1' }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: '1rem',
              paddingTop: 14,
              borderTop: kids.length > 1 ? '2px solid #cbd5e1' : 'none',
            }}
          >
            {kids.map((child) => (
              <div
                key={child.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {kids.length > 1 && (
                  <div
                    style={{
                      width: 2,
                      height: 14,
                      background: '#cbd5e1',
                      marginTop: -14,
                    }}
                  />
                )}
                <VisualOrgBranch
                  node={child}
                  collapsed={collapsed}
                  selectedEmployeeId={selectedEmployeeId}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface CompactTreeBranchProps {
  node: OrgEmployeeNode
  collapsed: Set<string>
  selectedEmployeeId: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  depth: number
}

function CompactTreeBranch({
  node,
  collapsed,
  selectedEmployeeId,
  onToggle,
  onSelect,
  depth,
}: CompactTreeBranchProps) {
  const kids = node.children ?? []
  const isCollapsed = collapsed.has(node.id)
  const isSelected = selectedEmployeeId === node.id
  const roleStyle = getRoleStyle(node.role)

  return (
    <div style={{ marginLeft: depth > 0 ? '1.35rem' : 0, marginTop: '0.5rem' }}>
      <div
        onClick={() => onSelect(node.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.6rem 0.85rem',
          border: isSelected
            ? `2px solid ${roleStyle.border}`
            : node.matched
              ? '2px solid #d97706'
              : '1px solid #e2e8f0',
          borderLeft: `4px solid ${roleStyle.border}`,
          borderRadius: '0.5rem',
          background: node.matched ? '#fffbeb' : isSelected ? roleStyle.bg : '#fff',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {kids.length > 0 ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.id)
              }}
              style={{ minWidth: '1.75rem', padding: '0.1rem 0.35rem' }}
            >
              {isCollapsed ? '+' : '−'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: '1.75rem', textAlign: 'center', color: '#94a3b8' }}>
              •
            </span>
          )}
          <div>
            <div>
              <strong>{node.full_name}</strong>{' '}
              <span
                className="badge"
                style={{ background: roleStyle.bg, color: roleStyle.text }}
              >
                {node.role}
              </span>
              {node.employee_id && (
                <span style={{ fontSize: '0.74rem', color: 'var(--muted)', marginLeft: '0.4rem' }}>
                  {node.employee_id}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              {node.designation || node.email} · {node.company_name}
              {node.departments.length > 0 ? ` · ${node.departments.join(', ')}` : ''}
              {node.teams.length > 0 ? ` · ${node.teams.join(', ')}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span className="badge">{node.projects_count} proj</span>
          <span className="badge">{node.active_tasks_count} tasks</span>
          {node.overdue_tasks_count > 0 && (
            <span className="badge badge-critical">{node.overdue_tasks_count} overdue</span>
          )}
          <Link
            to={`/employees/${node.id}`}
            onClick={(e) => e.stopPropagation()}
            className="btn btn-sm"
          >
            Profile
          </Link>
        </div>
      </div>

      {!isCollapsed &&
        kids.map((child) => (
          <CompactTreeBranch
            key={child.id}
            node={child}
            collapsed={collapsed}
            selectedEmployeeId={selectedEmployeeId}
            onToggle={onToggle}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

function EmployeeChip({
  emp,
  selected,
  onSelect,
}: {
  emp: OrgEmployeeNode
  selected: boolean
  onSelect: (id: string) => void
}) {
  const roleStyle = getRoleStyle(emp.role)
  return (
    <button
      type="button"
      onClick={() => onSelect(emp.id)}
      style={{
        textAlign: 'left',
        padding: '0.5rem 0.7rem',
        borderRadius: '0.5rem',
        border: selected
          ? `2px solid ${roleStyle.border}`
          : emp.matched
            ? '2px solid #d97706'
            : '1px solid #e2e8f0',
        borderLeft: `4px solid ${roleStyle.border}`,
        background: emp.matched ? '#fffbeb' : selected ? roleStyle.bg : '#fff',
        cursor: 'pointer',
        minWidth: 205,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#0f172a' }}>
        {emp.full_name}
        {emp.is_head ? ' ★ Head' : emp.is_leader ? ' ★ Lead' : ''}
      </div>
      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
        {emp.role}
        {emp.designation ? ` · ${emp.designation}` : ''}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.2rem' }}>
        {emp.projects_count} proj · {emp.active_tasks_count} tasks
        {emp.manager_name ? ` · Reports to ${emp.manager_name}` : ''}
      </div>
    </button>
  )
}

export function Page() {
  const { user: currentUser } = useAuth()
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [hierarchy, setHierarchy] = useState<OrganizationHierarchyResponse | null>(null)
  const [mode, setMode] = useState<ChartMode>('visual')
  const [companyFilter, setCompanyFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [employeeDetail, setEmployeeDetail] = useState<HierarchyEmployeeDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Reporting manager quick editor (CEO / CompanyInCharge only)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignCompanyId, setAssignCompanyId] = useState('')
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const [assignManagerId, setAssignManagerId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canManageReporting = Boolean(
    currentUser?.is_superuser ||
      (currentUser?.roles ?? []).some((r) =>
        ['CEO', 'COMPANYINCHARGE'].includes(r.toUpperCase()),
      ),
  )

  useEffect(() => {
    projectsApi
      .getLookup()
      .then((data) => {
        setLookup(data)
        if (data.companies.length > 0) {
          setAssignCompanyId(data.companies[0].id)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    loadHierarchy()
  }, [companyFilter, deptFilter, teamFilter, activeSearch])

  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeDetail(null)
      return
    }
    setLoadingDetail(true)
    organizationApi
      .getHierarchyEmployeeDetail(selectedEmployeeId, companyFilter || undefined)
      .then(setEmployeeDetail)
      .catch(() => setEmployeeDetail(null))
      .finally(() => setLoadingDetail(false))
  }, [selectedEmployeeId, companyFilter])

  async function loadHierarchy() {
    setLoading(true)
    setError(null)
    try {
      const res = await organizationApi.getHierarchy({
        company: companyFilter || undefined,
        department: deptFilter || undefined,
        team: teamFilter || undefined,
        search: activeSearch || undefined,
      })
      setHierarchy(res)
      // When searching, auto-expand everything so matches are immediately visible
      if (activeSearch) {
        setCollapsed(new Set())
      }
    } catch (err) {
      setError(extractError(err, 'Failed to load organization hierarchy.'))
    } finally {
      setLoading(false)
    }
  }

  const companyUsers = useMemo(() => {
    if (!lookup) return []
    return lookup.users.filter(
      (u) =>
        u.account_status === 'Active' &&
        (!assignCompanyId || u.company_ids?.includes(assignCompanyId)),
    )
  }, [lookup, assignCompanyId])

  useEffect(() => {
    if (companyUsers.length === 0) {
      setAssignEmployeeId('')
      setAssignManagerId('')
      return
    }
    if (!companyUsers.some((u) => u.id === assignEmployeeId)) {
      setAssignEmployeeId(companyUsers[0].id)
    }
  }, [companyUsers, assignEmployeeId])

  function handleToggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleExpandAll() {
    setCollapsed(new Set())
  }

  function handleCollapseAll() {
    if (!hierarchy) return
    if (mode === 'structure') {
      setCollapsed(collectAllStructureIds(hierarchy.structure))
    } else {
      setCollapsed(collectAllReportingIds(hierarchy.reporting_tree))
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    setActiveSearch(searchInput.trim())
  }

  function handleClearSearch() {
    setSearchInput('')
    setActiveSearch('')
  }

  async function handleAssignManager(e: FormEvent) {
    e.preventDefault()
    if (!assignEmployeeId) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await authApi.assignReportingManager(assignEmployeeId, {
        company: assignCompanyId || undefined,
        manager: assignManagerId || null,
      })
      await loadHierarchy()
      if (selectedEmployeeId === assignEmployeeId || selectedEmployeeId === assignManagerId) {
        const refreshed = await organizationApi
          .getHierarchyEmployeeDetail(selectedEmployeeId, companyFilter || undefined)
          .catch(() => null)
        if (refreshed) setEmployeeDetail(refreshed)
      }
      setSuccess(
        assignManagerId
          ? 'Reporting manager assigned and organization chart updated.'
          : 'Active reporting manager ended.',
      )
    } catch (err) {
      setError(extractError(err, 'Failed to update reporting manager.'))
    } finally {
      setSubmitting(false)
    }
  }

  function renderTeamBlock(team: OrgTeamNode) {
    const key = `team:${team.id}`
    const isCollapsed = collapsed.has(key)
    return (
      <div
        key={team.id}
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '0.65rem 0.8rem',
          background: '#f8fafc',
          marginTop: '0.55rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{ minWidth: '1.7rem', padding: '0.1rem 0.35rem' }}
              onClick={() => handleToggle(key)}
            >
              {isCollapsed ? '+' : '−'}
            </button>
            <div>
              <strong>Team: {team.name}</strong>{' '}
              {team.code && (
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>({team.code})</span>
              )}
              {team.leader && (
                <span style={{ fontSize: '0.78rem', color: '#0369a1', marginLeft: '0.5rem' }}>
                  Leader: {team.leader.full_name}
                </span>
              )}
            </div>
          </div>
          <span className="badge">{team.members_count} member(s)</span>
        </div>

        {!isCollapsed && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginTop: '0.6rem', paddingLeft: '2.1rem' }}>
            {team.members.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>No active team members.</span>
            ) : (
              team.members.map((m) => (
                <EmployeeChip
                  key={m.id}
                  emp={m}
                  selected={selectedEmployeeId === m.id}
                  onSelect={setSelectedEmployeeId}
                />
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  function renderDepartmentBlock(dept: OrgDepartmentNode) {
    const key = `dept:${dept.id}`
    const isCollapsed = collapsed.has(key)
    return (
      <div
        key={dept.id}
        style={{
          border: '1px solid #cbd5e1',
          borderLeft: '4px solid #b45309',
          borderRadius: '0.55rem',
          padding: '0.75rem 0.9rem',
          background: '#fff',
          marginTop: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{ minWidth: '1.75rem', padding: '0.12rem 0.4rem' }}
              onClick={() => handleToggle(key)}
            >
              {isCollapsed ? '+' : '−'}
            </button>
            <div>
              <strong>Department: {dept.name}</strong>{' '}
              {dept.code && (
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>({dept.code})</span>
              )}
              {dept.head && (
                <span style={{ fontSize: '0.8rem', color: '#b45309', marginLeft: '0.5rem' }}>
                  Head: {dept.head.full_name}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <span className="badge">{dept.teams_count} team(s)</span>
            <span className="badge">{dept.employees_count} member(s)</span>
          </div>
        </div>

        {!isCollapsed && (
          <div style={{ paddingLeft: '1.6rem', marginTop: '0.5rem' }}>
            {dept.teams.map(renderTeamBlock)}

            {dept.unassigned_members.length > 0 && (
              <div style={{ marginTop: '0.65rem' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                  Department Members (no team assigned)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {dept.unassigned_members.map((m) => (
                    <EmployeeChip
                      key={m.id}
                      emp={m}
                      selected={selectedEmployeeId === m.id}
                      onSelect={setSelectedEmployeeId}
                    />
                  ))}
                </div>
              </div>
            )}

            {dept.teams.length === 0 && dept.unassigned_members.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0.4rem 0 0' }}>
                No active teams or members in this department.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 3 (§5.3 &amp; §5.4) · Organization Hierarchy</p>
          <h1>Organization Chart &amp; Hierarchy</h1>
          <p>
            Explore the CEO-to-employee reporting hierarchy and company/department/team structure.
            Click any employee to inspect direct reports, assigned projects, and active tasks.
          </p>
        </div>
        <div className="btn-row">
          {canManageReporting && (
            <button
              type="button"
              className="btn"
              onClick={() => setShowAssignForm((v) => !v)}
            >
              {showAssignForm ? 'Hide Manager Assignment' : 'Assign Reporting Manager'}
            </button>
          )}
          <Link to="/departments" className="btn">
            Departments
          </Link>
          <Link to="/teams" className="btn">
            Teams
          </Link>
          <Link to="/employees" className="btn btn-primary">
            Employees
          </Link>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="card"
          style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}
        >
          {success}
        </div>
      )}

      {hierarchy && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Companies</div>
            <div className="stat-value">{hierarchy.summary.companies_count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Departments</div>
            <div className="stat-value">{hierarchy.summary.departments_count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Teams</div>
            <div className="stat-value">{hierarchy.summary.teams_count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Employees</div>
            <div className="stat-value">{hierarchy.summary.employees_count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Reporting Links</div>
            <div className="stat-value">{hierarchy.summary.reporting_links_count}</div>
          </div>
        </div>
      )}

      {canManageReporting && showAssignForm && (
        <form className="card" onSubmit={handleAssignManager} style={{ marginBottom: '1.25rem' }}>
          <h3>Assign / Change Reporting Manager</h3>
          <div className="form-grid" style={{ marginTop: '0.75rem' }}>
            <div className="form-field">
              <label>Company *</label>
              <select
                className="select"
                value={assignCompanyId}
                onChange={(e) => setAssignCompanyId(e.target.value)}
              >
                {(lookup?.companies ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Employee *</label>
              <select
                className="select"
                required
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
              >
                {companyUsers.length === 0 && <option value="">No active members</option>}
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Reports To (Manager)</label>
              <select
                className="select"
                value={assignManagerId}
                onChange={(e) => setAssignManagerId(e.target.value)}
              >
                <option value="">None (End active manager)</option>
                {companyUsers
                  .filter((u) => u.id !== assignEmployeeId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.designation || u.email})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !assignEmployeeId}
            >
              {submitting ? 'Updating…' : 'Save Reporting Relationship'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.9rem',
          }}
        >
          <div className="btn-row">
            <button
              type="button"
              className={`btn ${mode === 'visual' ? 'btn-primary' : ''}`}
              onClick={() => setMode('visual')}
            >
              Visual Org Chart
            </button>
            <button
              type="button"
              className={`btn ${mode === 'compact' ? 'btn-primary' : ''}`}
              onClick={() => setMode('compact')}
            >
              Compact Reporting Tree
            </button>
            <button
              type="button"
              className={`btn ${mode === 'structure' ? 'btn-primary' : ''}`}
              onClick={() => setMode('structure')}
            >
              Company → Dept → Team
            </button>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn-sm" onClick={handleExpandAll}>
              Expand All
            </button>
            <button type="button" className="btn btn-sm" onClick={handleCollapseAll}>
              Collapse All
            </button>
          </div>
        </div>

        <form className="filter-bar" onSubmit={handleSearchSubmit}>
          <input
            className="input"
            placeholder="Search employee name, email, ID, designation…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ minWidth: 230 }}
          />
          <button type="submit" className="btn">
            Search
          </button>
          {activeSearch && (
            <button type="button" className="btn" onClick={handleClearSearch}>
              Clear
            </button>
          )}
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value)
              setDeptFilter('')
              setTeamFilter('')
            }}
          >
            <option value="">All Authorized Companies</option>
            {(lookup?.companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <select
            className="select"
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value)
              setTeamFilter('')
            }}
          >
            <option value="">All Departments</option>
            {(lookup?.departments ?? [])
              .filter((d) => !companyFilter || d.company_id === companyFilter)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">All Teams</option>
            {(lookup?.teams ?? [])
              .filter((t) => !deptFilter || t.department_id === deptFilter)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </form>

        {activeSearch && hierarchy && (
          <div style={{ fontSize: '0.84rem', color: '#92400e', marginBottom: '0.75rem' }}>
            Showing {hierarchy.summary.matched_employee_ids.length} match(es) for &ldquo;
            {activeSearch}&rdquo; (matching nodes highlighted in amber).
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: selectedEmployeeId ? 'minmax(0, 1fr) 360px' : '1fr',
            gap: '1.25rem',
            alignItems: 'start',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {loading ? (
              <p style={{ color: 'var(--muted)' }}>Loading organization hierarchy…</p>
            ) : !hierarchy ? (
              <p style={{ color: 'var(--muted)' }}>No hierarchy data available.</p>
            ) : mode === 'visual' ? (
              hierarchy.reporting_tree.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No employees match the current filters.</p>
              ) : (
                <div
                  style={{
                    overflowX: 'auto',
                    padding: '1rem 0.5rem 1.25rem',
                    border: '1px solid #f1f5f9',
                    borderRadius: '0.6rem',
                    background: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      gap: '1.5rem',
                      minWidth: 'max-content',
                      padding: '0 1rem',
                    }}
                  >
                    {hierarchy.reporting_tree.map((root) => (
                      <VisualOrgBranch
                        key={root.id}
                        node={root}
                        collapsed={collapsed}
                        selectedEmployeeId={selectedEmployeeId}
                        onToggle={handleToggle}
                        onSelect={setSelectedEmployeeId}
                      />
                    ))}
                  </div>
                </div>
              )
            ) : mode === 'compact' ? (
              hierarchy.reporting_tree.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No employees match the current filters.</p>
              ) : (
                <div>
                  {hierarchy.reporting_tree.map((root) => (
                    <CompactTreeBranch
                      key={root.id}
                      node={root}
                      collapsed={collapsed}
                      selectedEmployeeId={selectedEmployeeId}
                      onToggle={handleToggle}
                      onSelect={setSelectedEmployeeId}
                      depth={0}
                    />
                  ))}
                </div>
              )
            ) : hierarchy.structure.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>
                No organizational units match the current filters.
              </p>
            ) : (
              <div>
                {hierarchy.structure.map((co) => {
                  const key = `co:${co.id}`
                  const isCollapsed = collapsed.has(key)
                  return (
                    <div
                      key={co.id}
                      style={{
                        border: '1px solid #cbd5e1',
                        borderTop: '4px solid #1d4ed8',
                        borderRadius: '0.65rem',
                        padding: '0.9rem 1rem',
                        marginBottom: '1rem',
                        background: '#f8fafc',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleToggle(key)}
                          >
                            {isCollapsed ? '+' : '−'}
                          </button>
                          <div>
                            <strong style={{ fontSize: '1.02rem' }}>{co.name}</strong>{' '}
                            <span className="badge">{co.code}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="badge">{co.departments_count} dept(s)</span>
                          <span className="badge">{co.teams_count} team(s)</span>
                          <span className="badge badge-active">{co.employees_count} employee(s)</span>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div style={{ marginTop: '0.75rem' }}>
                          {(co.ceos.length > 0 || co.incharges.length > 0 || co.project_managers.length > 0) && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                                Executive &amp; Company Leadership
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                                {[...co.ceos, ...co.incharges, ...co.project_managers].map((leader) => (
                                  <EmployeeChip
                                    key={`${co.id}-lead-${leader.id}`}
                                    emp={leader}
                                    selected={selectedEmployeeId === leader.id}
                                    onSelect={setSelectedEmployeeId}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {co.departments.map(renderDepartmentBlock)}

                          {co.unassigned_employees.length > 0 && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                                Company Members (no department assigned)
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                                {co.unassigned_employees.map((m) => (
                                  <EmployeeChip
                                    key={`${co.id}-un-${m.id}`}
                                    emp={m}
                                    selected={selectedEmployeeId === m.id}
                                    onSelect={setSelectedEmployeeId}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selectedEmployeeId && (
            <aside
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '0.65rem',
                padding: '1rem',
                background: '#fff',
                position: 'sticky',
                top: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <strong style={{ fontSize: '0.92rem' }}>Employee Details</strong>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSelectedEmployeeId(null)}
                >
                  Close
                </button>
              </div>

              {loadingDetail ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>Loading details…</p>
              ) : !employeeDetail ? (
                <p style={{ color: '#991b1b', fontSize: '0.86rem' }}>
                  Unable to load employee details.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      {employeeDetail.employee.full_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {employeeDetail.employee.designation || 'No designation'} ·{' '}
                      {employeeDetail.employee.email}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                      {employeeDetail.employee.roles.map((r) => (
                        <span key={r} className="badge">
                          {r}
                        </span>
                      ))}
                      {employeeDetail.employee.employee_id && (
                        <span className="badge">{employeeDetail.employee.employee_id}</span>
                      )}
                    </div>
                    <div style={{ marginTop: '0.6rem' }}>
                      <Link
                        to={`/employees/${employeeDetail.employee.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        Open Full Profile →
                      </Link>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                      Direct Reporting Relationships
                    </div>
                    <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--muted)' }}>Reports to: </span>
                      {employeeDetail.reporting_managers.length === 0 ? (
                        <span>None (Top level)</span>
                      ) : (
                        employeeDetail.reporting_managers.map((m, idx) => (
                          <span key={m.relationship_id}>
                            {idx > 0 ? ', ' : ''}
                            <button
                              type="button"
                              onClick={() => setSelectedEmployeeId(m.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#2563eb',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              {m.full_name}
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--muted)' }}>
                        Direct reports ({employeeDetail.direct_reports.length}):{' '}
                      </span>
                      {employeeDetail.direct_reports.length === 0 ? (
                        <span>None</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.3rem' }}>
                          {employeeDetail.direct_reports.map((dr) => (
                            <button
                              key={dr.relationship_id}
                              type="button"
                              className="btn btn-sm"
                              style={{ fontSize: '0.74rem' }}
                              onClick={() => setSelectedEmployeeId(dr.id)}
                            >
                              {dr.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                      Departments &amp; Teams
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {employeeDetail.departments.map((d) => (
                        <span key={d.id} className="badge">
                          Dept: {d.department_name}
                          {d.is_head ? ' (Head)' : ''}
                        </span>
                      ))}
                      {employeeDetail.teams.map((t) => (
                        <span key={t.id} className="badge">
                          Team: {t.team_name}
                          {t.is_leader ? ' (Leader)' : ''}
                        </span>
                      ))}
                      {employeeDetail.departments.length === 0 &&
                        employeeDetail.teams.length === 0 && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            No department or team assigned.
                          </span>
                        )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.4rem' }}>
                      Assigned Projects ({employeeDetail.assigned_projects.length})
                    </div>
                    {employeeDetail.assigned_projects.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        No authorized assigned projects.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {employeeDetail.assigned_projects.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              padding: '0.45rem 0.6rem',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.45rem',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                              <Link
                                to={`/projects/${p.id}`}
                                style={{ color: '#2563eb', fontWeight: 600 }}
                              >
                                {p.name}
                              </Link>
                              <span className="badge">{p.status}</span>
                            </div>
                            <div style={{ color: 'var(--muted)', marginTop: '0.15rem' }}>
                              {p.code} · {p.role_in_project} · {Math.round(p.progress)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: '0.4rem' }}>
                      Assigned Tasks ({employeeDetail.task_summary.total})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                      <span className="badge">{employeeDetail.task_summary.active} active</span>
                      <span className="badge badge-active">
                        {employeeDetail.task_summary.completed} done
                      </span>
                      {employeeDetail.task_summary.overdue > 0 && (
                        <span className="badge badge-critical">
                          {employeeDetail.task_summary.overdue} overdue
                        </span>
                      )}
                      {employeeDetail.task_summary.blocked > 0 && (
                        <span className="badge badge-critical">
                          {employeeDetail.task_summary.blocked} blocked
                        </span>
                      )}
                    </div>
                    {employeeDetail.assigned_tasks.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        No authorized tasks assigned.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 220, overflowY: 'auto' }}>
                        {employeeDetail.assigned_tasks.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              padding: '0.45rem 0.6rem',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.45rem',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                              <Link
                                to={`/tasks/${t.id}`}
                                style={{ color: '#0f172a', fontWeight: 600 }}
                              >
                                {t.title}
                              </Link>
                              <span
                                className={`badge ${t.is_overdue ? 'badge-critical' : ''}`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <div style={{ color: 'var(--muted)', marginTop: '0.15rem' }}>
                              {t.project_code} · {t.priority}
                              {t.due_date ? ` · Due ${t.due_date}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
