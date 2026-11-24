import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authApi } from '@/modules/accounts/api'
import { ApiError } from '@/api/client'

export function Page() {
  const [params] = useSearchParams()
  const [uid, setUid] = useState(params.get('uid') ?? '')
  const [token, setToken] = useState(params.get('token') ?? '')
  const [status, setStatus] = useState<'idle' | 'activating' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const u = params.get('uid')
    const t = params.get('token')
    if (u && t) {
      setStatus('activating')
      authApi
        .activateAccount({ uid: u, token: t })
        .then((res) => {
          setMessage(res.detail || 'Your account has been activated. You can now sign in.')
          setStatus('success')
        })
        .catch((err) => {
          const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
          setMessage(
            (body?.detail as string) ||
              'Activation failed. The link may have expired or already been used.',
          )
          setStatus('error')
        })
    }
  }, [params])

  async function handleManualActivate(e: FormEvent) {
    e.preventDefault()
    setStatus('activating')
    try {
      const res = await authApi.activateAccount({ uid: uid.trim(), token: token.trim() })
      setMessage(res.detail || 'Your account has been activated. You can now sign in.')
      setStatus('success')
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown> | null) : null
      setMessage((body?.detail as string) || 'Activation failed.')
      setStatus('error')
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
        <p className="eyebrow">TMS · Account Activation</p>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.45rem' }}>Activate Account</h2>

        {status === 'activating' && (
          <p style={{ color: 'var(--muted)' }}>Activating your account…</p>
        )}

        {status === 'success' && (
          <div>
            <p style={{ color: '#065f46', marginBottom: '1rem' }}>{message}</p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Sign in
            </Link>
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <form
            onSubmit={handleManualActivate}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {status === 'error' && (
              <div
                style={{
                  padding: '0.7rem 0.9rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.45rem',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                }}
              >
                {message}
              </div>
            )}
            <div className="form-field">
              <label htmlFor="act-uid">User UID</label>
              <input
                id="act-uid"
                type="text"
                className="input"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="act-token">Activation Token</label>
              <input
                id="act-token"
                type="text"
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Confirm Activation
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
