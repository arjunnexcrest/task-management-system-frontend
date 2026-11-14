import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type LookupData,
  type OrganizationDepartment,
  projectsApi,
} from '@/modules/projects/api'

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create Department form
  const [newCompany, setNewCompany] = useState('')
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newHead, setNewHead] = useState('')

  // Transfer employee form
  const [transferDeptId, setTransferDeptId] = useState('')
  const [transferUserId, setTransferUserId] = useState('')
  const [transferIsHead, setTransferIsHead] = useState(false)

  useEffect(() => {
    projectsApi.getLookup().then((data) => {
      setLookup(data)
      if (data.companies.length > 0) {
        setNewCompany(data.companies[0].id)
      }
      if (data.users.length > 0) {
        setTransferUserId(data.users[0].id)
      }
    })
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [companyFilter])

  async function loadDepartments() {
    setLoading(true)
    try {
      const list = await projectsApi.listDepartments(companyFilter || undefined)
      setDepartments(list)
      if (list.length > 0 && !transferDeptId) {
        setTransferDeptId(list[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateDepartment(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.createDepartment({
        company: newCompany,
        name: newName.trim(),
        code: newCode.trim() || undefined,
        department_head: newHead || null,
      })
      setNewName('')
      setNewCode('')
      await loadDepartments()
      setSuccess('Department created and Department Head assigned.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department')
    }
  }

  async function handleAssignHead(deptId: string, userId: string) {
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.assignDepartmentHead(deptId, userId || null)
      await loadDepartments()
      setSuccess('Department Head updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign Department Head')
    }
  }

  async function handleTransferEmployee(e: FormEvent) {
    e.preventDefault()
    if (!transferDeptId || !transferUserId) return
    setError(null)
    setSuccess(null)
    try {
      await projectsApi.transferEmployeeToDepartment(
        transferDeptId,
        transferUserId,
        transferIsHead,
      )
      await loadDepartments()
      setSuccess(
        'Employee transferred while preserving previous department membership history (SRS §5.1).',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer employee')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 3 (§5.1) · Department Management</p>
          <h1>Departments &amp; Department Heads</h1>
          <p>
            Create company departments, assign Department Heads, transfer employees while preserving
            history, and track project participation.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/teams" className="btn">
            Manage Teams
          </Link>
          <Link to="/projects" className="btn btn-primary">
            Map to Projects
          </Link>
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

      <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
        <form className="card" onSubmit={handleCreateDepartment}>
          <h3>Create Department &amp; Assign Head</h3>
          <div className="form-grid" style={{ marginTop: '0.75rem' }}>
            <div className="form-field">
              <label>Company *</label>
              <select
                className="select"
                required
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
              >
                {lookup?.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Department Name *</label>
              <input
                className="input"
                required
                placeholder="e.g. Cloud Infrastructure"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Department Code</label>
              <input
                className="input"
                placeholder="e.g. CLOUD"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Department Head</label>
              <select
                className="select"
                value={newHead}
                onChange={(e) => setNewHead(e.target.value)}
              >
                <option value="">Unassigned</option>
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              + Create Department
            </button>
          </div>
        </form>

        <form className="card" onSubmit={handleTransferEmployee}>
          <h3>Assign / Transfer Employee to Department (SRS §5.1)</h3>
          <div className="form-grid" style={{ marginTop: '0.75rem' }}>
            <div className="form-field">
              <label>Target Department *</label>
              <select
                className="select"
                required
                value={transferDeptId}
                onChange={(e) => setTransferDeptId(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.company_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Employee *</label>
              <select
                className="select"
                required
                value={transferUserId}
                onChange={(e) => setTransferUserId(e.target.value)}
              >
                {lookup?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.designation || u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={transferIsHead}
              onChange={(e) => setTransferIsHead(e.target.checked)}
            />
            <span>Designate as Department Head</span>
          </label>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              Assign / Transfer Employee
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="filter-bar">
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="">All Companies</option>
            {lookup?.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading departments...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Company</th>
                <th>Department Head</th>
                <th>Teams</th>
                <th>Active Members</th>
                <th>Participating Projects</th>
                <th>Change Department Head</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Code: {d.code || '—'}
                    </div>
                  </td>
                  <td>
                    {d.company_name} ({d.company_code})
                  </td>
                  <td>
                    <strong>{d.department_head_name || 'Unassigned'}</strong>
                  </td>
                  <td>{d.teams_count}</td>
                  <td>{d.active_members_count}</td>
                  <td>
                    <span className="badge badge-active">
                      {d.mapped_projects_count} project(s)
                    </span>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={d.department_head_id || ''}
                      onChange={(e) => handleAssignHead(d.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {lookup?.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </select>
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
