import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  companiesApi,
  membershipsApi,
  type Company,
  type CompanyMembershipRecord,
} from '@/modules/companies/api'
import { authApi } from '@/modules/accounts/api'
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

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [memberships, setMemberships] = useState<CompanyMembershipRecord[]>([])
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

  // Assign existing user with company role
  const [existingUserId, setExistingUserId] = useState('')
  const [existingUserRole, setExistingUserRole] = useState('Employee')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [comp, compMemberships, everyUser] = await Promise.all([
        companiesApi.get(id),
        companiesApi.listMembers(id).catch(() => [] as CompanyMembershipRecord[]),
        authApi.listUsers().catch(() => [] as User[]),
      ])
      setCompany(comp)
      setMemberships(compMemberships)
      setAllUsers(everyUser)
    } catch (err) {
      setError(extractError(err, 'Failed to load company details.'))
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
      setError(extractError(err, 'Failed to create user.'))
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
      await companiesApi.addMember(id, {
        user: existingUserId,
        role: existingUserRole,
      })
      setSuccess('Existing employee added to this company with the selected role.')
      setExistingUserId('')
      setExistingUserRole('Employee')
      await loadData()
    } catch (err) {
      setError(extractError(err, 'Failed to assign employee to company.'))
    } finally {
      setAssigning(false)
    }
  }

  async function handleChangeMemberRole(membership: CompanyMembershipRecord, newRole: string) {
    setError(null)
    setSuccess(null)
    try {
      await membershipsApi.updateRole(membership.id, newRole)
      setSuccess(`Updated ${membership.user_full_name}'s role in ${company?.name} to ${newRole}.`)
      await loadData()
    } catch (err) {
      setError(extractError(err, 'Failed to update membership role.'))
    }
  }

  async function handleToggleMembershipStatus(membership: CompanyMembershipRecord) {
    setError(null)
    setSuccess(null)
    try {
      if (membership.is_active) {
        await membershipsApi.deactivate(membership.id)
        setSuccess(
          `Deactivated ${membership.user_full_name}'s access to ${company?.name} (history preserved).`,
        )
      } else {
        await membershipsApi.activate(membership.id)
        setSuccess(`Reactivated ${membership.user_full_name}'s access to ${company?.name}.`)
      }
      await loadData()
    } catch (err) {
      setError(extractError(err, 'Failed to update membership status.'))
    }
  }

  const activeMembersCount = memberships.filter((m) => m.is_active).length
  const memberUserIds = new Set(memberships.map((m) => m.user))
  const assignableUsers = allUsers.filter((u) => u.is_active && !memberUserIds.has(u.id))

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
          <button
            type="button"
            className="btn btn-primary"
            disabled={!company.is_active}
            onClick={() => setShowAddUser(!showAddUser)}
          >
            {showAddUser ? 'Close Form' : '+ Add User'}
          </button>
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

      {showAddUser && (
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
          <div className="stat-label">Active Members</div>
          <div className="stat-value">{activeMembersCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Memberships</div>
          <div className="stat-value">{memberships.length}</div>
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
          <h3 style={{ margin: 0 }}>
            Company Memberships ({activeMembersCount} active / {memberships.length} total)
          </h3>
          {company.is_active && assignableUsers.length > 0 && (
            <form
              onSubmit={handleAssignExisting}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
            >
              <select
                className="select"
                value={existingUserId}
                onChange={(e) => setExistingUserId(e.target.value)}
                required
                style={{ minWidth: 210 }}
              >
                <option value="">Assign existing employee…</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={existingUserRole}
                onChange={(e) => setExistingUserRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={assigning || !existingUserId}
              >
                {assigning ? 'Adding…' : '+ Add Member'}
              </button>
            </form>
          )}
        </div>

        {memberships.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No employees assigned to this company yet. Click <strong>+ Add User</strong> above to
            create one or assign an existing employee.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Company Role</th>
                <th>Membership Status</th>
                <th>Joined / Left</th>
                <th>Access Control</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link
                      to={`/employees/${m.user}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {m.user_full_name}
                    </Link>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {m.user_email}
                      {m.user_designation ? ` · ${m.user_designation}` : ''}
                    </div>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={m.role}
                      disabled={!m.is_active}
                      onChange={(e) => handleChangeMemberRole(m, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={m.is_active ? 'badge badge-active' : 'badge badge-critical'}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    <div>Joined: {m.joined_at?.slice(0, 10) || '—'}</div>
                    {m.left_at && <div>Revoked: {m.left_at.slice(0, 10)}</div>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!company.is_active && !m.is_active}
                      onClick={() => handleToggleMembershipStatus(m)}
                    >
                      {m.is_active ? 'Revoke Access' : 'Restore Access'}
                    </button>
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
