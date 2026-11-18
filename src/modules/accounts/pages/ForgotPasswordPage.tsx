import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { ApiError } from '@/api/client'

export function Page() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null
        setError((body?.detail as string) || 'Something went wrong. Please try again.')
      } else {
        setError('Unable to reach the server. Check your connection.')
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
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.25rem 2rem' }}>
        <p className="eyebrow">TMS · Password Recovery</p>
        <h2 style={{ marginBottom: '0.35rem', fontSize: '1.45rem' }}>
          {submitted ? 'Check your email' : 'Forgot password'}
        </h2>

        {submitted ? (
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              If that email is registered, a password reset link has been sent.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Back to Sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
          >
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
              Enter your registered work email and we will send you a password reset link.
            </p>

            <div className="form-field">
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@company.com"
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
              style={{ width: '100%' }}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <Link
              to="/login"
              style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)' }}
            >
              ← Back to Sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
