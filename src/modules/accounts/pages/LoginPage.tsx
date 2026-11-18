import { type FormEvent, useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { ApiError } from '@/api/client'
import { env } from '@/config/env'

export function Page() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const fromState = (location.state as { from?: string } | null)?.from

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to={fromState && fromState !== '/login' ? fromState : '/'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ identifier: identifier.trim(), password })
      const target = fromState && fromState !== '/login' ? fromState : '/'
      navigate(target, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null
        const detail = body?.detail
        const msg =
          (typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.join(' ')
              : null) ||
          (body?.non_field_errors as string[])?.join(' ') ||
          'Invalid credentials. Please try again.'
        setError(msg)
      } else {
        setError('Unable to reach the backend server (http://127.0.0.1:8000). Check that Django is running.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.25rem 2rem',
        }}
      >
        <div style={{ marginBottom: '1.6rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
            {env.appName}
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Sign in to your account
          </h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
            Authenticate with your work email or username to access the dashboard.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
        >
          <div className="form-field">
            <label htmlFor="identifier">Email or Username</label>
            <input
              id="identifier"
              type="text"
              className="input"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              disabled={loading}
              placeholder="admin@tms.local or admin"
            />
          </div>

          <div className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                htmlFor="password"
                style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.8rem', color: 'var(--accent-brand)', fontWeight: 500 }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: '0.7rem 0.9rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.45rem',
                color: '#991b1b',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.68rem 1rem', marginTop: '0.25rem' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
