import { type FormEvent, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { ApiError } from '@/api/client'

export function Page() {
  const [params] = useSearchParams()
  const [uid, setUid] = useState(params.get('uid') ?? '')
  const [token, setToken] = useState(params.get('token') ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!uid || !token) {
      setError('Missing reset UID or token.')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword({ uid, token, new_password: newPassword })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null
        const msg =
          (body?.detail as string) ||
          (body?.new_password as string[])?.join(' ') ||
          'Reset failed. The link may have expired.'
        setError(msg)
      } else {
        setError('Unable to reach the server.')
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
        <p className="eyebrow">TMS · Password Reset</p>
        <h2 style={{ marginBottom: '0.35rem', fontSize: '1.45rem' }}>
          {done ? 'Password updated' : 'Set a new password'}
        </h2>

        {done ? (
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
          >
            {(!params.get('uid') || !params.get('token')) && (
              <>
                <div className="form-field">
                  <label htmlFor="uid">UID (from reset link)</label>
                  <input
                    id="uid"
                    type="text"
                    className="input"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="token">Reset Token</label>
                  <input
                    id="token"
                    type="text"
                    className="input"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-field">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                className="input"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirm">Confirm New Password</label>
              <input
                id="confirm"
                type="password"
                className="input"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              style={{ width: '100%' }}
            >
              {loading ? 'Saving…' : 'Set New Password'}
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
