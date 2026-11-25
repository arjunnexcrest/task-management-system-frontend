import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { companiesApi, type Company } from '@/modules/companies/api'
import { authApi } from '@/modules/accounts/api'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import { ApiError } from '@/api/client'
import type { User } from '@/types'

const ROLE_OPTIONS = [
  { value: 'Employee', label: 'Employee' },
  { value: 'TeamLeader', label: 'Team Leader' },
  { value: 'DepartmentHead', label: 'Department Head' },
  { value: 'ProjectManager', label: 'Project Manager' },
  { value: 'CompanyInCharge', label: 'Company In-Charge' },
  { value: 'CEO', label: 'CEO' },
]

export function Page() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermissions()
  const canManageUsers = can('can_manage_users')
  const [company, setCompany] = useState<Company | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add New User form
  const [showAddUser, setShowAddUser] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Employee')
  const [designation, setDesignation] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Assign existing user
  const [existingUserId, setExistingUserId] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [comp, compUsers, everyUser] = await Promise.all([
        companiesApi.get(id),
        authApi.listUsers({ company: id }).catch(() => [] as User[]),
        authApi.listUsers().catch(() => [] as User[]),
      ])
      setCompany(comp)
      setUsers(compUsers)
      setAllUsers(everyUser)
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setError((body?.detail as string) || 'Failed to load company details.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      await authApi.createUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim() || undefined,
        password,
        company: id,
        role,
        designation: designation.trim() || undefined,
        phone: phone.trim() || undefined,
        is_active: true,
      })
      setSuccess(`User "${fullName.trim()}" created and added to ${company?.name}.`)
      setFullName('')
      setEmail('')
      setUsername('')
      setPassword('')
      setRole('Employee')
      setDesignation('')
      setPhone('')
      setShowAddUser(false)
      await loadData()
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      const msg =
        (body?.detail as string) ||
        (body?.email as string[])?.join(' ') ||
        (body?.username as string[])?.join(' ') ||
        (body?.password as string[])?.join(' ') ||
        'Failed to create user.'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleAssignExisting(e: FormEvent) {
    e.preventDefault()
    if (!id || !existingUserId) return
    setAssigning(true)
    setError(null)
    setSuccess(null)
    try {
      await authApi.updateUser(existingUserId, { company: id })
      setSuccess('Existing user assigned to this company.')
      setExistingUserId('')
      await loadData()
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setError((body?.detail as string) || 'Failed to assign user.')
    } finally {
      setAssigning(false)
    }
  }

  const companyUserIds = new Set(users.map((u) => u.id))
  const assignableUsers = allUsers.filter((u) => !companyUserIds.has(u.id))

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">Loading company details…</div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="page-container">
        <div className="card">
          <p style={{ color: '#991b1b' }}>{error || 'Company not found.'}</p>
          <Link to="/companies" className="btn">
            ← Back to Companies
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Company Details · {company.code}</p>
          <h1>{company.name}</h1>
          <p>
            {company.email || 'No email'} · {company.phone || 'No phone'}
          </p>
        </div>
        <div className="btn-row">
          <span
            className={
              company.is_active ? 'badge badge-active' : 'badge badge-critical'
            }
          >
            {company.is_active ? 'Active' : 'Inactive'}
          </span>
          {canManageUsers && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddUser(!showAddUser)}
            >
              {showAddUser ? 'Close Form' : '+ Add User'}
            </button>
          )}
          <Link to="/companies" className="btn">
            ← All Companies
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

      {canManageUsers && showAddUser && (
        <form onSubmit={handleCreateUser} className="card">
          <h3>Create New User in {company.name}</h3>
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
              <label>Email *</label>
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
              <label>Username (optional)</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="janedoe"
              />
            </div>
            <div className="form-field">
              <label>Password (min 8 chars) *</label>
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
              <label>Designation</label>
              <input
                className="input"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Software Engineer"
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
          </div>
          <div className="btn-row" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create & Add User'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowAddUser(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Code</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {company.code}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Members</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Created</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {company.created_at.slice(0, 10)}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Address</h3>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          {company.address || 'No address specified.'}
        </p>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Company Users ({users.length})</h3>
          {canManageUsers && assignableUsers.length > 0 && (
            <form
              onSubmit={handleAssignExisting}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <select
                className="select"
                value={existingUserId}
                onChange={(e) => setExistingUserId(e.target.value)}
                required
                style={{ minWidth: 220 }}
              >
                <option value="">Assign existing user…</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn btn-sm"
                disabled={assigning || !existingUserId}
              >
                {assigning ? 'Adding…' : '+ Assign'}
              </button>
            </form>
          )}
        </div>

        {users.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No users assigned to this company yet. Click <strong>+ Add User</strong> above to create one.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link
                      to={`/employees/${u.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {u.full_name}
                    </Link>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge">{u.role || (u.roles ?? [])[0] || 'Employee'}</span>
                  </td>
                  <td>{u.designation || '—'}</td>
                  <td>
                    <span
                      className={
                        u.is_active ? 'badge badge-active' : 'badge badge-critical'
                      }
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
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
