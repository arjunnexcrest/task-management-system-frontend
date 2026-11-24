import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { projectsApi, type LookupData } from '@/modules/projects/api'
import { ApiError } from '@/api/client'
import type { HierarchyNode } from '@/types'

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

interface TreeBranchProps {
  node: HierarchyNode
  childrenMap: Map<string, HierarchyNode[]>
  collapsed: Set<string>
  onToggle: (id: string) => void
  depth: number
}

function TreeBranch({ node, childrenMap, collapsed, onToggle, depth }: TreeBranchProps) {
  const kids = childrenMap.get(node.id) ?? []
  const isCollapsed = collapsed.has(node.id)

  return (
    <div style={{ marginLeft: depth > 0 ? '1.5rem' : 0, marginTop: '0.6rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.65rem 0.9rem',
          border: '1px solid #e5e7eb',
          borderLeft: depth === 0 ? '4px solid var(--accent-brand, #2563eb)' : '3px solid #94a3b8',
          borderRadius: '0.5rem',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {kids.length > 0 ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onToggle(node.id)}
              style={{ minWidth: '1.8rem', padding: '0.15rem 0.4rem' }}
            >
              {isCollapsed ? '+' : '−'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: '1.8rem', textAlign: 'center', color: 'var(--muted)' }}>
              •
            </span>
          )}
          <div>
            <div>
              <Link
                to={`/employees/${node.id}`}
                style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
              >
                {node.full_name}
              </Link>{' '}
              <span className="badge">{node.role}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              {node.designation || node.email} · {node.company_name}
              {node.departments.length > 0 ? ` · ${node.departments.join(', ')}` : ''}
              {node.teams.length > 0 ? ` · ${node.teams.join(', ')}` : ''}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {kids.length > 0 ? `${kids.length} direct report(s)` : 'Individual contributor'}
        </div>
      </div>

      {!isCollapsed &&
        kids.map((child) => (
          <TreeBranch
            key={child.id}
            node={child}
            childrenMap={childrenMap}
            collapsed={collapsed}
            onToggle={onToggle}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [nodes, setNodes] = useState<HierarchyNode[]>([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Quick Assign Reporting Manager form
  const [assignCompanyId, setAssignCompanyId] = useState('')
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const [assignManagerId, setAssignManagerId] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
  }, [companyFilter, deptFilter, teamFilter])

  async function loadHierarchy() {
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.getReportingHierarchy({
        company: companyFilter || undefined,
        department: deptFilter || undefined,
        team: teamFilter || undefined,
      })
      setNodes(res.nodes)
    } catch (err) {
      setError(extractError(err, 'Failed to load reporting hierarchy.'))
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

  const { roots, childrenMap } = useMemo(() => {
    const nodeIds = new Set(nodes.map((n) => n.id))
    const map = new Map<string, HierarchyNode[]>()
    const top: HierarchyNode[] = []
    for (const n of nodes) {
      if (n.manager_id && nodeIds.has(n.manager_id) && n.manager_id !== n.id) {
        const list = map.get(n.manager_id) ?? []
        list.push(n)
        map.set(n.manager_id, list)
      } else {
        top.push(n)
      }
    }
    return { roots: top, childrenMap: map }
  }, [nodes])

  function handleToggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      setSuccess(
        assignManagerId
          ? 'Reporting manager assigned and hierarchy updated.'
          : 'Active reporting manager ended.',
      )
    } catch (err) {
      setError(extractError(err, 'Failed to update reporting manager.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 3 (§5.3) · Reporting Hierarchy</p>
          <h1>Organization Chart &amp; Reporting Managers</h1>
          <p>
            Visualize the CEO-to-employee reporting tree and assign reporting managers with
            automatic cycle detection and history preservation.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/employees" className="btn">
            Employees
          </Link>
          <Link to="/departments" className="btn">
            Departments
          </Link>
          <Link to="/teams" className="btn btn-primary">
            Teams
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

      <div className="card">
        <div className="filter-bar">
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value)
              setDeptFilter('')
              setTeamFilter('')
            }}
          >
            <option value="">All Companies</option>
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
          <button
            type="button"
            className="btn"
            onClick={() => setCollapsed(new Set())}
          >
            Expand All
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading organization hierarchy…</p>
        ) : roots.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No employees found for the selected filters.</p>
        ) : (
          <div>
            {roots.map((root) => (
              <TreeBranch
                key={root.id}
                node={root}
                childrenMap={childrenMap}
                collapsed={collapsed}
                onToggle={handleToggle}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
