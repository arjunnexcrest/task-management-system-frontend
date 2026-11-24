import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { type Department, organizationApi } from '@/modules/organization/api'

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create Department form
  const [newCompany, setNewCompany] = useState('')
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newHead, setNewHead] = useState('')

  // Edit Department inline state
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Transfer employee form
  const [transferDeptId, setTransferDeptId] = useState('')
  const [transferUserId, setTransferUserId] = useState('')
  const [transferIsHead, setTransferIsHead] = useState(false)

  useEffect(() => {
    projectsApi
      .getLookup()
      .then((data) => {
        setLookup(data)
        if (data.companies.length > 0) {
          setNewCompany(data.companies[0].id)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load lookup data')
      })
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [companyFilter, statusFilter])

  function getUsersForCompany(companyId: string) {
    if (!lookup) return []
    if (!companyId) return lookup.users
    return lookup.users.filter((u) => u.company_ids?.includes(companyId))
  }

  const createCompanyUsers = useMemo(
    () => getUsersForCompany(newCompany),
    [lookup, newCompany],
  )

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.status === 'Active'),
    [departments],
  )

  const selectedTransferDept = useMemo(
    () => departments.find((d) => d.id === transferDeptId) || null,
    [departments, transferDeptId],
  )

  const transferCompanyUsers = useMemo(
    () => (selectedTransferDept ? getUsersForCompany(selectedTransferDept.company) : []),
    [lookup, selectedTransferDept],
  )

  useEffect(() => {
    if (newHead && !createCompanyUsers.some((u) => u.id === newHead)) {
      setNewHead('')
    }
  }, [createCompanyUsers, newHead])

  useEffect(() => {
    if (transferCompanyUsers.length === 0) {
      setTransferUserId('')
    } else if (!transferCompanyUsers.some((u) => u.id === transferUserId)) {
      setTransferUserId(transferCompanyUsers[0].id)
    }
  }, [transferCompanyUsers, transferUserId])

  async function loadDepartments(overrideSearch?: string) {
    setLoading(true)
    try {
      const list = await organizationApi.listDepartments({
        company: companyFilter || undefined,
        status: statusFilter || undefined,
        search: overrideSearch !== undefined ? overrideSearch : searchQuery || undefined,
      })
      setDepartments(list)
      const firstActive = list.find((d) => d.status === 'Active')
      if (firstActive && (!transferDeptId || !list.some((d) => d.id === transferDeptId))) {
        setTransferDeptId(firstActive.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    await loadDepartments(searchQuery)
  }

  async function handleCreateDepartment(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.createDepartment({
        company: newCompany,
        name: newName.trim(),
        code: newCode.trim() || null,
        department_head: newHead || null,
      })
      setNewName('')
      setNewCode('')
      setNewHead('')
      await loadDepartments()
      setSuccess('Department created successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department')
    }
  }

  function startEdit(dept: Department) {
    setEditingDeptId(dept.id)
    setEditName(dept.name)
    setEditCode(dept.code || '')
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingDeptId(null)
    setEditName('')
    setEditCode('')
  }

  async function handleSaveEdit(deptId: string) {
    if (!editName.trim()) {
      setError('Department name cannot be blank.')
      return
    }
    setSavingEdit(true)
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.updateDepartment(deptId, {
        name: editName.trim(),
        code: editCode.trim() || null,
      })
      setEditingDeptId(null)
      await loadDepartments()
      setSuccess('Department updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleToggleStatus(dept: Department) {
    setError(null)
    setSuccess(null)
    try {
      if (dept.status === 'Active') {
        await organizationApi.deactivateDepartment(dept.id)
        setSuccess(`Department "${dept.name}" deactivated (history preserved).`)
      } else {
        await organizationApi.activateDepartment(dept.id)
        setSuccess(`Department "${dept.name}" reactivated.`)
      }
      await loadDepartments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department status')
    }
  }

  async function handleAssignHead(deptId: string, userId: string) {
    setError(null)
    setSuccess(null)
    try {
      await organizationApi.assignDepartmentHead(deptId, userId || null)
      await loadDepartments()
      setSuccess(userId ? 'Department Head assigned.' : 'Department Head unassigned.')
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
      await organizationApi.transferEmployeeToDepartment(
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
            Create, edit, and deactivate company departments, assign Department Heads from the
            department&apos;s company, and transfer employees while preserving history.
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
              <label>Department Head (Company Members)</label>
              <select
                className="select"
                value={newHead}
                onChange={(e) => setNewHead(e.target.value)}
              >
                <option value="">Unassigned</option>
                {createCompanyUsers.map((u) => (
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
              <label>Target Active Department *</label>
              <select
                className="select"
                required
                value={transferDeptId}
                onChange={(e) => setTransferDeptId(e.target.value)}
              >
                {activeDepartments.length === 0 && (
                  <option value="">No active departments</option>
                )}
                {activeDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.company_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Employee (Same Company) *</label>
              <select
                className="select"
                required
                value={transferUserId}
                onChange={(e) => setTransferUserId(e.target.value)}
              >
                {transferCompanyUsers.length === 0 && (
                  <option value="">No active members in this company</option>
                )}
                {transferCompanyUsers.map((u) => (
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!transferDeptId || !transferUserId}
            >
              Assign / Transfer Employee
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <form className="filter-bar" onSubmit={handleSearchSubmit}>
          <input
            className="input"
            placeholder="Search by department name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: '220px' }}
          />
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
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button type="submit" className="btn">
            Search
          </button>
        </form>

        {loading ? (
          <p>Loading departments...</p>
        ) : departments.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0' }}>
            No departments found matching the current filters.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Company</th>
                <th>Status</th>
                <th>Department Head</th>
                <th>Teams / Members</th>
                <th>Projects</th>
                <th>Assign / Change Head</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const isEditing = editingDeptId === d.id
                const deptCompanyUsers = getUsersForCompany(d.company)
                return (
                  <tr key={d.id}>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <input
                            className="input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Department name"
                          />
                          <input
                            className="input"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            placeholder="Code (optional)"
                          />
                        </div>
                      ) : (
                        <>
                          <strong>{d.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            Code: {d.code || '—'}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {d.company_name} ({d.company_code})
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          d.status === 'Active' ? 'badge-active' : 'badge-inactive'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <strong>{d.department_head_name || 'Unassigned'}</strong>
                      {d.department_head_email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {d.department_head_email}
                        </div>
                      )}
                    </td>
                    <td>
                      {d.teams_count} team(s) · {d.active_members_count} member(s)
                    </td>
                    <td>
                      <span className="badge badge-active">
                        {d.mapped_projects_count} project(s)
                      </span>
                    </td>
                    <td>
                      <select
                        className="select"
                        disabled={d.status !== 'Active'}
                        value={d.department_head_id || ''}
                        onChange={(e) => handleAssignHead(d.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {deptCompanyUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="btn-row">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={savingEdit}
                              onClick={() => handleSaveEdit(d.id)}
                            >
                              Save
                            </button>
                            <button type="button" className="btn" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => startEdit(d)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleToggleStatus(d)}
                            >
                              {d.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
