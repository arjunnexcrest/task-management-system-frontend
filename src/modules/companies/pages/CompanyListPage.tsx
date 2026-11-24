import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { companiesApi, type Company } from '@/modules/companies/api'
import { ApiError } from '@/api/client'

export function Page() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create / Edit modal state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCompanies()
  }, [activeFilter])

  async function loadCompanies(searchQuery = search) {
    setLoading(true)
    setError(null)
    try {
      const data = await companiesApi.list({
        search: searchQuery.trim() || undefined,
        is_active: activeFilter || undefined,
      })
      setCompanies(data.results)
      setTotalCount(data.count)
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null
        if (err.status === 403) {
          setError('Access denied (403): Only the CEO can view and manage companies.')
        } else {
          setError((body?.detail as string) || `Error ${err.status}`)
        }
      } else {
        setError('Unable to load companies.')
      }
    } finally {
      setLoading(false)
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setName('')
    setCode('')
    setEmail('')
    setPhone('')
    setAddress('')
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  function openEditForm(c: Company) {
    setEditingId(c.id)
    setName(c.name)
    setCode(c.code)
    setEmail(c.email ?? '')
    setPhone(c.phone ?? '')
    setAddress(c.address ?? '')
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      }
      if (editingId) {
        await companiesApi.update(editingId, payload)
        setSuccess(`Company "${name.trim()}" updated successfully.`)
      } else {
        await companiesApi.create(payload)
        setSuccess(`Company "${name.trim()}" created successfully.`)
      }
      setShowForm(false)
      setEditingId(null)
      await loadCompanies()
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null
        const msg =
          (body?.detail as string) ||
          (body?.name as string[])?.join(' ') ||
          (body?.code as string[])?.join(' ') ||
          (body?.email as string[])?.join(' ') ||
          'Failed to save company.'
        setError(msg)
      } else {
        setError('Failed to save company.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(c: Company) {
    if (!window.confirm(`Deactivate company "${c.name}"? (Soft delete — records are preserved)`)) {
      return
    }
    setError(null)
    setSuccess(null)
    try {
      await companiesApi.softDelete(c.id)
      setSuccess(`Company "${c.name}" deactivated.`)
      await loadCompanies()
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setError((body?.detail as string) || 'Failed to deactivate company.')
    }
  }

  async function handleReactivate(c: Company) {
    setError(null)
    setSuccess(null)
    try {
      await companiesApi.update(c.id, { is_active: true })
      setSuccess(`Company "${c.name}" reactivated.`)
      await loadCompanies()
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setError((body?.detail as string) || 'Failed to reactivate company.')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">TMS · Multi-Company Management</p>
          <h1>Companies ({totalCount})</h1>
          <p>
            Create, edit, search, and soft-deactivate companies (CEO only).
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (showForm ? setShowForm(false) : openCreateForm())}
          >
            {showForm ? 'Close Form' : '+ New Company'}
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

      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3>{editingId ? 'Edit Company' : 'Create New Company'}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Company Name *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Acme Corporation"
              />
            </div>
            <div className="form-field">
              <label>Company Code (optional — auto-generated)</label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ACME"
              />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@acme.com"
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
          <div className="form-field" style={{ marginTop: '1rem' }}>
            <label>Address</label>
            <textarea
              className="textarea"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Business Park, Suite 400"
            />
          </div>
          <div className="btn-row" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Company'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search companies by name, code, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadCompanies(search)
            }}
          />
          <select
            className="select"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
          <button type="button" className="btn" onClick={() => loadCompanies(search)}>
            Search
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading companies…</p>
        ) : companies.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No companies found.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Members</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      <Link
                        to={`/companies/${c.id}`}
                        style={{ color: 'var(--accent-brand)' }}
                      >
                        {c.name}
                      </Link>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      Code: {c.code}
                    </div>
                  </td>
                  <td>
                    <div>{c.email || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {c.phone || '—'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 240 }}>{c.address || '—'}</td>
                  <td>{c.members_count}</td>
                  <td>
                    <span
                      className={
                        c.is_active ? 'badge badge-active' : 'badge badge-critical'
                      }
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-row">
                      <Link to={`/companies/${c.id}`} className="btn btn-sm">
                        View
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => openEditForm(c)}
                      >
                        Edit
                      </button>
                      {c.is_active ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ color: '#991b1b', borderColor: '#fecaca' }}
                          onClick={() => handleDeactivate(c)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleReactivate(c)}
                        >
                          Activate
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
