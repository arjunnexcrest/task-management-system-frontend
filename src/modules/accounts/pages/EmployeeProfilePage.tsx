import { type FormEvent, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { ApiError } from '@/api/client'
import type { User } from '@/types'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser, refreshUser } = useAuth()

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [saving, setSaving] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const isOwnProfile = Boolean(currentUser && profile && currentUser.id === profile.id)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    const loader =
      currentUser && id === currentUser.id ? authApi.getMe() : authApi.getUser(id)

    loader
      .then((u) => {
        setProfile(u)
        setFullName(u.full_name)
        setPhone(u.phone ?? '')
        setDesignation(u.designation ?? '')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile.')
      })
      .finally(() => setLoading(false))
  }, [id, currentUser?.id])

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = isOwnProfile
        ? await authApi.updateMe({
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            designation: designation.trim() || null,
          })
        : await authApi.updateUser(profile.id, {
            full_name: fullName.trim(),
            phone: phone.trim(),
            designation: designation.trim(),
          })
      setProfile(updated)
      if (isOwnProfile) await refreshUser()
      setSuccess('Profile updated successfully.')
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setError((body?.detail as string) || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setChangingPw(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      })
      setSuccess(res.detail || 'Password changed successfully.')
      setOldPassword('')
      setNewPassword('')
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      const msg =
        (body?.detail as string) ||
        (body?.old_password as string[])?.join(' ') ||
        (body?.new_password as string[])?.join(' ') ||
        'Failed to change password.'
      setError(msg)
    } finally {
      setChangingPw(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">Loading employee profile…</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page-container">
        <div className="card">
          <p style={{ color: '#991b1b' }}>{error || 'Employee not found.'}</p>
          <Link to="/employees" className="btn">
            ← Back to Employees
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">TMS · Employee Profile</p>
          <h1>{profile.full_name}</h1>
          <p>
            {profile.email} · @{profile.username} · Employee ID: {profile.employee_id || '—'}
          </p>
        </div>
        <div className="btn-row">
          <span
            className={
              profile.account_status === 'Active'
                ? 'badge badge-active'
                : 'badge badge-critical'
            }
          >
            {profile.account_status}
          </span>
          <Link to="/employees" className="btn">
            ← All Employees
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

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Roles</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {(profile.roles ?? []).join(', ') || 'Employee'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Departments</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {(profile.department_names ?? []).join(', ') || '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Teams</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {(profile.team_names ?? []).join(', ') || '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Direct Reports</div>
          <div className="stat-value">{profile.direct_reports_count ?? 0}</div>
        </div>
      </div>

      <div className="form-grid">
        <form onSubmit={handleUpdateProfile} className="card">
          <h3>Profile Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-field">
              <label>Full Name</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Designation</label>
              <input
                className="input"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          <div className="card">
            <h3>Reporting Hierarchy</h3>
            {(profile.reporting_managers ?? []).length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                No reporting manager assigned.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {(profile.reporting_managers ?? []).map((mgr) => (
                  <li key={mgr.id} style={{ marginBottom: '0.4rem' }}>
                    <Link
                      to={`/employees/${mgr.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {mgr.full_name}
                    </Link>{' '}
                    ({mgr.designation || mgr.email})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isOwnProfile && (
            <form onSubmit={handleChangePassword} className="card">
              <h3>Change Password</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div className="form-field">
                  <label>Current Password</label>
                  <input
                    type="password"
                    className="input"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>New Password (min 8 chars)</label>
                  <input
                    type="password"
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={changingPw}>
                  {changingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
