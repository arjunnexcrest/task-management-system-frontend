import { type FormEvent, useEffect, useState } from 'react'
import { apiRequest, ApiError } from '@/api/client'
import { useAuth } from '@/modules/accounts/context/AuthContext'

interface RolePermissionItem {
  id: string
  role: string
  permission: string
  permission_code: string
}

interface RoleItem {
  id: string
  name: string
  code: string
  description: string | null
  is_system_role: boolean
  role_permissions: RolePermissionItem[]
}

interface PermissionItem {
  id: string
  code: string
  description: string | null
}

function unwrap<T>(res: T[] | { results?: T[] }): T[] {
  return Array.isArray(res) ? res : (res.results ?? [])
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    const body = err.body as Record<string, unknown>
    if (typeof body.detail === 'string') return body.detail
    const msgs = Object.entries(body)
      .map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.join(', ')}` : typeof v === 'string' ? `${k}: ${v}` : null))
      .filter(Boolean)
    if (msgs.length > 0) return msgs.join(' | ')
  }
  return err instanceof Error ? err.message : fallback
}

export function Page() {
  const { user } = useAuth()
  const isCeo = Boolean(
    user?.is_superuser ||
      (user?.roles ?? []).some((r) => r.toUpperCase() === 'CEO') ||
      user?.role?.toUpperCase() === 'CEO',
  )

  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // New custom role
  const [roleName, setRoleName] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [roleDesc, setRoleDesc] = useState('')

  // New permission
  const [permCode, setPermCode] = useState('')
  const [permDesc, setPermDesc] = useState('')

  // Map permission to role
  const [mapRoleId, setMapRoleId] = useState('')
  const [mapPermId, setMapPermId] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiRequest<RoleItem[] | { results?: RoleItem[] }>('api/rbac/roles/'),
        apiRequest<PermissionItem[] | { results?: PermissionItem[] }>('api/rbac/permissions/'),
      ])
      const rList = unwrap(rolesRes)
      const pList = unwrap(permsRes)
      setRoles(rList)
      setPermissions(pList)
      if (rList.length > 0 && !mapRoleId) setMapRoleId(rList[0].id)
      if (pList.length > 0 && !mapPermId) setMapPermId(pList[0].id)
    } catch (err) {
      setError(extractError(err, 'Failed to load roles and permissions.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateRole(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await apiRequest<RoleItem>('api/rbac/roles/', {
        method: 'POST',
        body: {
          name: roleName.trim(),
          code: roleCode.trim(),
          description: roleDesc.trim() || null,
          is_system_role: false,
        },
      })
      setRoleName('')
      setRoleCode('')
      setRoleDesc('')
      await loadData()
      setSuccess('Custom role created.')
    } catch (err) {
      setError(extractError(err, 'Failed to create role.'))
    }
  }

  async function handleDeleteRole(r: RoleItem) {
    setError(null)
    setSuccess(null)
    try {
      await apiRequest<void>(`api/rbac/roles/${r.id}/`, { method: 'DELETE' })
      await loadData()
      setSuccess(`Deleted custom role "${r.name}".`)
    } catch (err) {
      setError(extractError(err, 'Failed to delete role.'))
    }
  }

  async function handleCreatePermission(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await apiRequest<PermissionItem>('api/rbac/permissions/', {
        method: 'POST',
        body: {
          code: permCode.trim(),
          description: permDesc.trim() || null,
        },
      })
      setPermCode('')
      setPermDesc('')
      await loadData()
      setSuccess('Permission created.')
    } catch (err) {
      setError(extractError(err, 'Failed to create permission.'))
    }
  }

  async function handleAttachPermission(e: FormEvent) {
    e.preventDefault()
    if (!mapRoleId || !mapPermId) return
    setError(null)
    setSuccess(null)
    try {
      await apiRequest<RolePermissionItem>('api/rbac/role-permissions/', {
        method: 'POST',
        body: { role: mapRoleId, permission: mapPermId },
      })
      await loadData()
      setSuccess('Permission assigned to role.')
    } catch (err) {
      setError(extractError(err, 'Failed to assign permission.'))
    }
  }

  async function handleDetachPermission(rpId: string) {
    setError(null)
    setSuccess(null)
    try {
      await apiRequest<void>(`api/rbac/role-permissions/${rpId}/`, { method: 'DELETE' })
      await loadData()
      setSuccess('Permission removed from role.')
    } catch (err) {
      setError(extractError(err, 'Failed to remove permission.'))
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §2.8 · Access Control &amp; Authorization</p>
          <h1>Roles &amp; Permissions</h1>
          <p>
            Manage system roles, custom roles, and granular permission mappings enforced by the
            backend.
          </p>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
          {success}
        </div>
      )}

      {isCeo && (
        <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
          <form className="card" onSubmit={handleCreateRole}>
            <h3>Create Custom Role</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div className="form-field">
                <label>Role Name *</label>
                <input
                  className="input"
                  required
                  placeholder="e.g. QA Reviewer"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Role Code *</label>
                <input
                  className="input"
                  required
                  placeholder="e.g. QAReviewer"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Description</label>
                <input
                  className="input"
                  placeholder="Optional role summary"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                + Create Role
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <form className="card" onSubmit={handleCreatePermission}>
              <h3>Add Permission Code</h3>
              <div className="form-grid" style={{ marginTop: '0.75rem' }}>
                <div className="form-field">
                  <label>Code *</label>
                  <input
                    className="input"
                    required
                    placeholder="e.g. report.export"
                    value={permCode}
                    onChange={(e) => setPermCode(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Description</label>
                  <input
                    className="input"
                    placeholder="Allow exporting reports"
                    value={permDesc}
                    onChange={(e) => setPermDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: '0.9rem' }}>
                <button type="submit" className="btn btn-primary">
                  + Add Permission
                </button>
              </div>
            </form>

            <form className="card" onSubmit={handleAttachPermission}>
              <h3>Assign Permission to Role</h3>
              <div className="form-grid" style={{ marginTop: '0.75rem' }}>
                <div className="form-field">
                  <label>Role</label>
                  <select
                    className="select"
                    value={mapRoleId}
                    onChange={(e) => setMapRoleId(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Permission</label>
                  <select
                    className="select"
                    value={mapPermId}
                    onChange={(e) => setMapPermId(e.target.value)}
                  >
                    {permissions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: '0.9rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!mapRoleId || !mapPermId}
                >
                  Assign Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Configured Roles ({roles.length})</h3>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading roles…</p>
        ) : roles.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No roles configured yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Type</th>
                <th>Permissions</th>
                {isCeo && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {r.code}
                      {r.description ? ` · ${r.description}` : ''}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${r.is_system_role ? 'badge-active' : ''}`}>
                      {r.is_system_role ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td>
                    {r.role_permissions.length === 0 ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {r.role_permissions.map((rp) => (
                          <span
                            key={rp.id}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            {rp.permission_code}
                            {isCeo && (
                              <button
                                type="button"
                                onClick={() => handleDetachPermission(rp.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontWeight: 700,
                                }}
                                title="Remove permission"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {isCeo && (
                    <td>
                      {!r.is_system_role ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleDeleteRole(r)}
                        >
                          Delete
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Protected</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
