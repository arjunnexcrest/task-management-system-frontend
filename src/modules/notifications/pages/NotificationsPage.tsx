import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type NotificationItem,
  notificationsApi,
} from '@/modules/notifications/api'

export function Page() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [filterRead, setFilterRead] = useState<'' | 'false' | 'true'>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  async function loadNotifications() {
    setLoading(true)
    setError(null)
    try {
      const list = await notificationsApi.list({
        is_read: filterRead || undefined,
        mine: true,
      })
      setItems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [filterRead])

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id)
      await loadNotifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read.')
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await notificationsApi.markAllRead()
      await loadNotifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all read.')
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = items.filter((i) => !i.is_read).length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §13 · In-App Notification Center</p>
          <h1>Notifications ({unreadCount} unread)</h1>
          <p>
            Task assignments, deadline reminders, review approvals, correction requests, and
            project updates linked directly to their tasks and projects.
          </p>
        </div>
        <div className="btn-row">
          <select
            className="select"
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value as '' | 'false' | 'true')}
          >
            <option value="">All Notifications</option>
            <option value="false">Unread Only</option>
            <option value="true">Read Only</option>
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={markingAll || unreadCount === 0}
            onClick={handleMarkAllRead}
          >
            {markingAll ? 'Updating…' : 'Mark All Read'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading notifications…</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            You are all caught up — no notifications match this filter.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '0.95rem 1.1rem',
                  borderRadius: '0.6rem',
                  border: n.is_read ? '1px solid var(--line)' : '1px solid #bfdbfe',
                  background: n.is_read ? '#ffffff' : '#f8fbff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {!n.is_read && <span className="badge badge-high">Unread</span>}
                    <span className="badge">{n.notification_type}</span>
                    <strong>{n.title}</strong>
                  </div>
                  <p style={{ margin: '0.35rem 0 0.45rem', fontSize: '0.88rem', color: 'var(--ink)' }}>
                    {n.message}
                  </p>
                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--muted)' }}>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.related_task && (
                      <Link
                        to={`/tasks/${n.related_task}`}
                        style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                      >
                        Open Task{n.related_task_title ? `: ${n.related_task_title}` : ''} →
                      </Link>
                    )}
                    {n.related_project && (
                      <Link
                        to={`/projects/${n.related_project}`}
                        style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                      >
                        Open Project{n.related_project_code ? `: ${n.related_project_code}` : ''} →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
