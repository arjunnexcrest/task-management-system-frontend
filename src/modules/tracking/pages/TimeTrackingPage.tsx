import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import { type Task, tasksApi } from '@/modules/tasks/api'
import { type TimeEntryItem, trackingApi } from '@/modules/tracking/api'

export function Page() {
  const { can } = usePermissions()
  const canApproveTime = can('can_review_tasks')

  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimeEntryItem[]>([])
  const [activeTimer, setActiveTimer] = useState<TimeEntryItem | null>(null)
  const [timerTaskId, setTimerTaskId] = useState('')
  const [manualTaskId, setManualTaskId] = useState('')
  const [manualMinutes, setManualMinutes] = useState('60')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [taskList, entryList, activeRes] = await Promise.all([
        tasksApi.listTasks(),
        trackingApi.listTimeEntries(),
        trackingApi.getActiveTimer(),
      ])
      setTasks(taskList)
      setEntries(entryList)
      setActiveTimer(activeRes.active_timer)
      if (taskList.length > 0) {
        if (!timerTaskId) setTimerTaskId(taskList[0].id)
        if (!manualTaskId) setManualTaskId(taskList[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time tracking data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleStartTimer() {
    if (!timerTaskId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const started = await trackingApi.startTimer(timerTaskId)
      setActiveTimer(started)
      setSuccess(`Live timer started on "${started.task_title}".`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStopTimer() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const stopped = await trackingApi.stopTimer()
      setActiveTimer(null)
      setSuccess(`Timer stopped: logged ${stopped.duration_minutes} minute(s) on "${stopped.task_title}".`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop timer.')
    } finally {
      setSaving(false)
    }
  }

  async function handleManualLog(e: FormEvent) {
    e.preventDefault()
    if (!manualTaskId || !manualMinutes) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await trackingApi.createTimeEntry({
        task: manualTaskId,
        duration_minutes: Number(manualMinutes),
        entry_type: 'Manual',
      })
      setSuccess(`Manual time entry (${manualMinutes} mins) recorded.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record manual time entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleApproval(entryId: string, decision: 'Approved' | 'Rejected') {
    setError(null)
    try {
      await trackingApi.approveTimeEntry(entryId, decision)
      setSuccess(`Time entry marked ${decision}.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update time entry approval.')
    }
  }

  const totalMinutes = entries.reduce((acc, e) => acc + (e.duration_minutes || 0), 0)
  const approvedMinutes = entries
    .filter((e) => e.approval_status === 'Approved')
    .reduce((acc, e) => acc + (e.duration_minutes || 0), 0)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §9.2 · Time Tracking &amp; Live Task Timer</p>
          <h1>Time Tracking</h1>
          <p>
            Run a live task timer (one active timer per employee) or log manual effort against your
            tasks.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/work-log" className="btn btn-primary">
            Daily Work Log &amp; Remarks →
          </Link>
          <Link to="/tasks/mine" className="btn">
            My Assignments
          </Link>
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

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Timer</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {activeTimer ? 'Running' : 'Idle'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            {activeTimer ? activeTimer.task_title : 'Ready to start'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Logged Hours</div>
          <div className="stat-value">{(totalMinutes / 60).toFixed(1)}h</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{totalMinutes} minutes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Hours</div>
          <div className="stat-value">{(approvedMinutes / 60).toFixed(1)}h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Time Entries</div>
          <div className="stat-value">{entries.length}</div>
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h3>Live Task Timer (1 Active Timer Rule)</h3>
          {activeTimer ? (
            <div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
                Currently tracking:{' '}
                <Link
                  to={`/tasks/${activeTimer.task}`}
                  style={{ color: 'var(--accent-brand)', fontWeight: 600 }}
                >
                  {activeTimer.task_title}
                </Link>
                {activeTimer.started_at && (
                  <span style={{ color: 'var(--muted)' }}>
                    {' '}
                    · started {new Date(activeTimer.started_at).toLocaleTimeString()}
                  </span>
                )}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleStopTimer}
              >
                {saving ? 'Stopping…' : 'Stop Timer & Save Entry'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-field">
                <label>Select Task</label>
                <select
                  className="select"
                  value={timerTaskId}
                  onChange={(e) => setTimerTaskId(e.target.value)}
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.project_code}] {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !timerTaskId}
                  onClick={handleStartTimer}
                >
                  {saving ? 'Starting…' : 'Start Live Timer'}
                </button>
              </div>
            </div>
          )}
        </div>

        <form className="card" onSubmit={handleManualLog}>
          <h3>Log Manual Time Entry</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-field">
              <label>Task *</label>
              <select
                className="select"
                required
                value={manualTaskId}
                onChange={(e) => setManualTaskId(e.target.value)}
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.project_code}] {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Duration (Minutes) *</label>
              <input
                type="number"
                min="1"
                step="5"
                required
                className="input"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                + Record Manual Time
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Time Log History ({entries.length})</h3>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading time entries…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No time entries logged yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Approval</th>
                <th>Logged At</th>
                {canApproveTime && <th>Review</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/tasks/${e.task}`} style={{ color: 'var(--accent-brand)', fontWeight: 600 }}>
                      {e.task_title}
                    </Link>
                    {e.project_code && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{e.project_code}</div>
                    )}
                  </td>
                  <td>{e.user_name}</td>
                  <td><span className="badge">{e.entry_type}</span></td>
                  <td>
                    {e.ended_at === null && e.entry_type === 'Timer' ? (
                      <span className="badge badge-high">Running…</span>
                    ) : (
                      `${e.duration_minutes}m (${(e.duration_minutes / 60).toFixed(2)}h)`
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        e.approval_status === 'Approved'
                          ? 'badge-active'
                          : e.approval_status === 'Rejected'
                            ? 'badge-critical'
                            : 'badge-medium'
                      }`}
                    >
                      {e.approval_status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  {canApproveTime && (
                    <td>
                      {e.approval_status === 'Pending' && !(e.entry_type === 'Timer' && !e.ended_at) && (
                        <div className="btn-row">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApproval(e.id, 'Approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleApproval(e.id, 'Rejected')}
                          >
                            Reject
                          </button>
                        </div>
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
