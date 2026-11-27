import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { companiesApi, type Company } from '@/modules/companies/api'
import { projectsApi, type LookupData } from '@/modules/projects/api'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { ApiError } from '@/api/client'
import type { User, UserStatus } from '@/types'

const ROLE_OPTIONS = [
  { value: 'Employee', label: 'Employee' },
  { value: 'TeamLeader', label: 'Team Leader' },
  { value: 'DepartmentHead', label: 'Department Head' },
  { value: 'ProjectManager', label: 'Project Manager' },
  { value: 'CompanyInCharge', label: 'Company In-Charge' },
  { value: 'CEO', label: 'CEO' },
]

export function Page() {
  const { user: currentUser, isAuthenticated } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [role, setRole] = useState('Employee')
  const [employeeId, setEmployeeId] = useState('')
  const [designation, setDesignation] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  const isCeo = Boolean(
    currentUser?.is_superuser ||
      (currentUser?.roles ?? []).some((r) => r.toUpperCase() === 'CEO') ||
      currentUser?.role?.toUpperCase() === 'CEO',
  )

  useEffect(() => {
    const companyLoader = isCeo
      ? companiesApi.list().then((res) => res.results)
      : companiesApi.myCompanies()
    companyLoader
      .then((list) => {
        setCompanies(list)
        if (list.length > 0) setCompanyId(list[0].id)
      })
      .catch(() => null)
    projectsApi
      .getLookup()
      .then(setLookup)
      .catch(() => null)
  }, [isCeo])

  useEffect(() => {
    loadUsers()
  }, [companyFilter, departmentFilter, teamFilter, roleFilter, statusFilter])

  async function loadUsers(searchQuery = search) {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.listUsers({
        search: searchQuery.trim() || undefined,
        company: companyFilter || undefined,
        department_id: departmentFilter || undefined,
        team_id: teamFilter || undefined,
        role: roleFilter || undefined,
        account_status: statusFilter || undefined,
      })
      setUsers(data)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Please sign in at /login to view and manage user accounts.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load employees.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateEmployee(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      await authApi.createUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim() || undefined,
        company: companyId || null,
        role,
        employee_id: employeeId.trim() || undefined,
        designation: designation.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password || undefined,
        account_status: 'Active',
        is_active: true,
      })
      setSuccess(`Employee "${fullName.trim()}" created successfully.`)
      setFullName('')
      setEmail('')
      setUsername('')
      setEmployeeId('')
      setDesignation('')
      setPhone('')
      setPassword('')
      setShowCreate(false)
      await loadUsers()
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      const msg =
        (body?.detail as string) ||
        (body?.email as string[])?.join(' ') ||
        (body?.username as string[])?.join(' ') ||
        'Failed to create employee (CEO privileges required).'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleLifecycleAction(
    targetUser: User,
    action: 'activate' | 'deactivate' | 'suspend' | 'unlock',
  ) {
    setError(null)
    setSuccess(null)
    try {
      if (action === 'activate') await authApi.activateUser(targetUser.id)
      if (action === 'deactivate') await authApi.deactivateUser(targetUser.id)
      if (action === 'suspend') await authApi.suspendUser(targetUser.id)
      if (action === 'unlock') await authApi.unlockUser(targetUser.id)
      setSuccess(`Updated account status for ${targetUser.full_name}.`)
      await loadUsers()
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setError((body?.detail as string) || 'Action failed (CEO privileges required).')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">TMS · Accounts &amp; Identity Management</p>
          <h1>Employees &amp; User Accounts</h1>
          <p>
            Search, filter by company &amp; role, create, and manage employee accounts.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/organization" className="btn">
            Org Chart
          </Link>
          {isAuthenticated && currentUser && (
            <Link to={`/employees/${currentUser.id}`} className="btn">
              My Profile
            </Link>
          )}
          {isCeo && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? 'Close Form' : '+ New Employee'}
            </button>
          )}
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

      {showCreate && (
        <form onSubmit={handleCreateEmployee} className="card">
          <h3>Create Employee Account</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Full Name *</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jane Doe"
              />
            </div>
            <div className="form-field">
              <label>Work Email *</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="jane@company.com"
              />
            </div>
            <div className="form-field">
              <label>Company</label>
              <select
                className="select"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Role *</label>
              <select
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Username (optional)</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="janedoe"
              />
            </div>
            <div className="form-field">
              <label>Employee ID</label>
              <input
                className="input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP-102"
              />
            </div>
            <div className="form-field">
              <label>Designation</label>
              <input
                className="input"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Software Engineer"
              />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100"
              />
            </div>
            <div className="form-field">
              <label>Initial Password (min 8 chars) *</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="StrongPass123!"
              />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create Employee'}
            </button>
            <button type="button" className="btn" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search by name, email, username, employee ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadUsers(search)
            }}
          />
          {companies.length > 0 && (
            <select
              className="select"
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value)
                setDepartmentFilter('')
                setTeamFilter('')
              }}
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {(lookup?.departments ?? []).length > 0 && (
            <select
              className="select"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value)
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
          )}
          {(lookup?.teams ?? []).length > 0 && (
            <select
              className="select"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="">All Teams</option>
              {(lookup?.teams ?? [])
                .filter((t) => !departmentFilter || t.department_id === departmentFilter)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          )}
          <select
            className="select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="PendingActivation">Pending Activation</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
            <option value="Deactivated">Deactivated</option>
          </select>
          <button type="button" className="btn" onClick={() => loadUsers(search)}>
            Search
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading employees…</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No employee records found.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Company &amp; Org</th>
                <th>Role &amp; Designation</th>
                <th>Reporting Manager</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      <Link
                        to={`/employees/${u.id}`}
                        style={{ color: 'var(--accent-brand)' }}
                      >
                        {u.full_name}
                      </Link>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {u.email} · @{u.username}
                      {u.employee_id ? ` · ${u.employee_id}` : ''}
                    </div>
                  </td>
                  <td>
                    <div>{u.company_name || '—'}</div>
                    {(u.department_names?.length || u.team_names?.length) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {[
                          ...(u.department_names ?? []),
                          ...(u.team_names ?? []),
                        ].join(' · ')}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div>
                      <span className="badge">{u.role || (u.roles ?? [])[0] || 'Employee'}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                      {u.designation || '—'}
                    </div>
                  </td>
                  <td>
                    {(u.reporting_managers ?? []).length === 0 ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</span>
                    ) : (
                      (u.reporting_managers ?? []).map((mgr) => (
                        <div key={mgr.id} style={{ fontSize: '0.85rem' }}>
                          <Link
                            to={`/employees/${mgr.id}`}
                            style={{ color: 'var(--accent-brand)', fontWeight: 500 }}
                          >
                            {mgr.full_name}
                          </Link>
                        </div>
                      ))
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        u.account_status === 'Active'
                          ? 'badge badge-active'
                          : u.account_status === 'Deactivated' || u.account_status === 'Suspended'
                            ? 'badge badge-critical'
                            : 'badge badge-medium'
                      }
                    >
                      {u.account_status}
                    </span>
                  </td>
                  <td>
                    <div className="btn-row">
                      <Link to={`/employees/${u.id}`} className="btn btn-sm">
                        Profile
                      </Link>
                      {isCeo &&
                        (u.account_status !== 'Active' ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleLifecycleAction(u, 'activate')}
                          >
                            Activate
                          </button>
                        ) : currentUser?.id !== u.id ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleLifecycleAction(u, 'deactivate')}
                          >
                            Deactivate
                          </button>
                        ) : null)}
                      {isCeo && (u.failed_login_attempts ?? 0) > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleLifecycleAction(u, 'unlock')}
                        >
                          Unlock
                        </button>
                      )}
                    </div>
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
