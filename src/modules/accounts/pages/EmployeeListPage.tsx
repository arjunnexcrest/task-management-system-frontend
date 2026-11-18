import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { ApiError } from '@/api/client'
import type { User, UserStatus } from '@/types'

export function Page() {
  const { user: currentUser, isAuthenticated } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [designation, setDesignation] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [statusFilter])

  async function loadUsers(searchQuery = search) {
    setLoading(true)
    setError(null)
    try {
      const data = await authApi.listUsers({
        search: searchQuery.trim() || undefined,
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
        username: username.trim() || email.split('@')[0],
        employee_id: employeeId.trim() || undefined,
        designation: designation.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password || undefined,
        account_status: 'Active',
        is_active: true,
      })
      setSuccess(`Employee "${fullName}" created successfully.`)
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
      setError(
        (body?.detail as string) ||
          JSON.stringify(body) ||
          'Failed to create employee (staff privileges required).',
      )
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
      setError((body?.detail as string) || 'Action failed (staff privileges required).')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">TMS · Accounts &amp; Identity Management</p>
          <h1>Employees &amp; User Accounts</h1>
          <p>
            Search, filter, create, and manage employee accounts. No hard deletes — deactivation preserves historical work records.
          </p>
        </div>
        <div className="btn-row">
          {isAuthenticated && currentUser && (
            <Link to={`/employees/${currentUser.id}`} className="btn">
              My Profile
            </Link>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? 'Close Form' : '+ New Employee'}
          </button>
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
              <label>Username *</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
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
            placeholder="Search by name, email, username, employee ID, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadUsers(search)
            }}
          />
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
                <th>Employee ID</th>
                <th>Designation / Roles</th>
                <th>Departments &amp; Teams</th>
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
                    </div>
                  </td>
                  <td>{u.employee_id || '—'}</td>
                  <td>
                    <div>{u.designation || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {(u.roles ?? []).join(', ')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem' }}>
                      {(u.department_names ?? []).join(', ') || '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {(u.team_names ?? []).join(', ')}
                    </div>
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
                      {u.account_status !== 'Active' ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleLifecycleAction(u, 'activate')}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleLifecycleAction(u, 'deactivate')}
                        >
                          Deactivate
                        </button>
                      )}
                      {(u.failed_login_attempts ?? 0) > 0 && (
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
