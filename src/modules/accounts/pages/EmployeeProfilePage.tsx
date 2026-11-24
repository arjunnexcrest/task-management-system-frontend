import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { projectsApi, type LookupData } from '@/modules/projects/api'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { ApiError } from '@/api/client'
import type { EmployeeProfileDetail } from '@/types'

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
  const { user: currentUser, refreshUser } = useAuth()

  const [profile, setProfile] = useState<EmployeeProfileDetail | null>(null)
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [saving, setSaving] = useState(false)

  // Reporting-manager assignment form
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [savingManager, setSavingManager] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const isOwnProfile = Boolean(currentUser && profile && currentUser.id === profile.id)
  const isCeoUser = Boolean(
    currentUser?.is_superuser || (currentUser?.roles ?? []).some((r) => r.toUpperCase() === 'CEO'),
  )
  const canManageReporting = Boolean(
    isCeoUser ||
      (currentUser?.roles ?? []).some((r) => r.toUpperCase() === 'COMPANYINCHARGE'),
  )

  useEffect(() => {
    projectsApi
      .getLookup()
      .then(setLookup)
      .catch(() => null)
  }, [])

  async function loadProfile() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const u = await authApi.getEmployeeProfile(id)
      setProfile(u)
      setFullName(u.full_name)
      setEmployeeCode(u.employee_id ?? '')
      setPhone(u.phone ?? '')
      setDesignation(u.designation ?? '')

      const defaultCompany =
        u.memberships?.[0]?.company || u.company || u.company_ids?.[0] || ''
      setSelectedCompanyId(defaultCompany)
      const currentMgr = (u.reporting_managers ?? []).find(
        (m) => !defaultCompany || m.company_id === defaultCompany,
      )
      setSelectedManagerId(currentMgr?.id ?? '')
    } catch (err) {
      setError(extractError(err, 'Failed to load profile.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [id])

  const eligibleManagers = useMemo(() => {
    if (!lookup || !profile) return []
    return lookup.users.filter((u) => {
      if (u.id === profile.id) return false
      if (u.account_status !== 'Active') return false
      if (selectedCompanyId && !u.company_ids?.includes(selectedCompanyId)) return false
      return true
    })
  }, [lookup, profile, selectedCompanyId])

  useEffect(() => {
    if (!profile || !selectedCompanyId) return
    const currentMgr = (profile.reporting_managers ?? []).find(
      (m) => m.company_id === selectedCompanyId,
    )
    setSelectedManagerId(currentMgr?.id ?? '')
  }, [selectedCompanyId, profile])

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await authApi.updateEmployeeProfile(profile.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        designation: designation.trim() || null,
        ...(isCeoUser ? { employee_id: employeeCode.trim() || '' } : {}),
      })
      setProfile(updated)
      if (isOwnProfile) await refreshUser()
      setSuccess('Profile updated successfully.')
    } catch (err) {
      setError(extractError(err, 'Failed to update profile.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignReportingManager(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSavingManager(true)
    setError(null)
    setSuccess(null)
    try {
      await authApi.assignReportingManager(profile.id, {
        company: selectedCompanyId || undefined,
        manager: selectedManagerId || null,
      })
      await loadProfile()
      setSuccess(
        selectedManagerId
          ? 'Reporting manager updated (previous reporting history preserved).'
          : 'Active reporting manager ended.',
      )
    } catch (err) {
      setError(extractError(err, 'Failed to update reporting manager.'))
    } finally {
      setSavingManager(false)
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
      setError(extractError(err, 'Failed to change password.'))
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
          <p className="eyebrow">TMS · Employee Profile &amp; Reporting Hierarchy</p>
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
          <Link to="/organization" className="btn">
            Org Chart
          </Link>
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
          <div className="stat-value" style={{ fontSize: '1.05rem' }}>
            {(profile.roles ?? []).join(', ') || 'Employee'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Departments</div>
          <div className="stat-value" style={{ fontSize: '1.05rem' }}>
            {profile.departments.length > 0
              ? profile.departments
                  .map((d) => `${d.department_name}${d.is_head ? ' (Head)' : ''}`)
                  .join(', ')
              : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Teams</div>
          <div className="stat-value" style={{ fontSize: '1.05rem' }}>
            {profile.teams.length > 0
              ? profile.teams
                  .map((t) => `${t.team_name}${t.is_leader ? ' (Leader)' : ''}`)
                  .join(', ')
              : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Direct Reports</div>
          <div className="stat-value">{profile.direct_reports.length}</div>
        </div>
      </div>

      <div className="form-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
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
              {isCeoUser && (
                <div className="form-field">
                  <label>Employee ID</label>
                  <input
                    className="input"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="EMP-102"
                  />
                </div>
              )}
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
              {(isOwnProfile || isCeoUser) && (
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              )}
            </div>
          </form>

          {(profile.memberships ?? []).length > 0 && (
            <div className="card">
              <h3>Company Memberships</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {(profile.memberships ?? []).map((m) => (
                  <li key={m.id} style={{ marginBottom: '0.4rem' }}>
                    <strong>{m.company_name}</strong> ({m.company_code}) —{' '}
                    <span className="badge">{m.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          <div className="card">
            <h3>Reporting Manager &amp; Upward Chain</h3>
            {(profile.reporting_managers ?? []).length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                No active reporting manager assigned.
              </p>
            ) : (
              <ul style={{ margin: '0 0 1rem', paddingLeft: '1.2rem' }}>
                {(profile.reporting_managers ?? []).map((mgr) => (
                  <li key={mgr.relationship_id || mgr.id} style={{ marginBottom: '0.4rem' }}>
                    <Link
                      to={`/employees/${mgr.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {mgr.full_name}
                    </Link>{' '}
                    ({mgr.designation || mgr.email})
                    {mgr.company_name ? ` · ${mgr.company_name}` : ''}
                    {mgr.start_date ? ` · since ${mgr.start_date}` : ''}
                  </li>
                ))}
              </ul>
            )}

            {profile.reporting_chain.length > 0 && (
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                <strong>Upward chain:</strong> {profile.full_name}
                {profile.reporting_chain.map((node) => (
                  <span key={node.id}>
                    {' '}→{' '}
                    <Link
                      to={`/employees/${node.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 500 }}
                    >
                      {node.full_name}
                    </Link>
                  </span>
                ))}
              </div>
            )}

            {canManageReporting && (profile.memberships ?? []).length > 0 && (
              <form
                onSubmit={handleAssignReportingManager}
                style={{
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  Assign / Change Reporting Manager
                </div>
                {(profile.memberships ?? []).length > 1 && (
                  <div className="form-field">
                    <label>Company</label>
                    <select
                      className="select"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                      {(profile.memberships ?? []).map((m) => (
                        <option key={m.id} value={m.company}>
                          {m.company_name} ({m.company_code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-field">
                  <label>Reporting Manager (Same Company)</label>
                  <select
                    className="select"
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                  >
                    <option value="">None (End active manager)</option>
                    {eligibleManagers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.designation || u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="btn-row">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingManager}
                  >
                    {savingManager ? 'Updating…' : 'Save Reporting Manager'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="card">
            <h3>Direct Reports ({profile.direct_reports.length})</h3>
            {profile.direct_reports.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                No active direct reports.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {profile.direct_reports.map((dr) => (
                  <li key={dr.relationship_id} style={{ marginBottom: '0.45rem' }}>
                    <Link
                      to={`/employees/${dr.id}`}
                      style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                    >
                      {dr.full_name}
                    </Link>{' '}
                    ({dr.designation || dr.email}) · {dr.company_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {profile.reporting_history.length > 0 && (
            <div className="card">
              <h3>Reporting History</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Company</th>
                    <th>Period</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.reporting_history.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <Link
                          to={`/employees/${h.manager_id}`}
                          style={{ color: 'var(--accent-brand)' }}
                        >
                          {h.manager_name}
                        </Link>
                      </td>
                      <td>{h.company_name}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {h.start_date} → {h.end_date || 'Present'}
                      </td>
                      <td>
                        <span
                          className={`badge ${h.is_active ? 'badge-active' : 'badge-inactive'}`}
                        >
                          {h.is_active ? 'Active' : 'Ended'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
