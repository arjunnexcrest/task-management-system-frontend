import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import {
  type OverdueSummaryResponse,
  type Task,
  type WorkingCalendarConfig,
  tasksApi,
} from '@/modules/tasks/api'

const WEEKDAYS = [
  { idx: 0, label: 'Mon' },
  { idx: 1, label: 'Tue' },
  { idx: 2, label: 'Wed' },
  { idx: 3, label: 'Thu' },
  { idx: 4, label: 'Fri' },
  { idx: 5, label: 'Sat' },
  { idx: 6, label: 'Sun' },
]

function getWeekBucket(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3) return 'Unscheduled'
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  const day = dt.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(dt)
  monday.setUTCDate(dt.getUTCDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return `Week of ${monday.toISOString().slice(0, 10)} → ${sunday.toISOString().slice(0, 10)}`
}

function getMonthBucket(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3) return 'Unscheduled'
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, 1))
  return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<OverdueSummaryResponse | null>(null)
  const [calendarCfg, setCalendarCfg] = useState<WorkingCalendarConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [companyFilter, setCompanyFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [dueStatusFilter, setDueStatusFilter] = useState('')
  const [scanning, setScanning] = useState(false)

  // Working Calendar Configuration Modal State (SRS §20.1 & §20.2)
  const [showCalModal, setShowCalModal] = useState(false)
  const [calDays, setCalDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [calHolidays, setCalHolidays] = useState<string[]>([])
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [calHours, setCalHours] = useState('8')
  const [calDueSoon, setCalDueSoon] = useState('3')
  const [calReminderDays, setCalReminderDays] = useState('2')
  const [calSaving, setCalSaving] = useState(false)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), projectsApi.listProjects()])
      .then(([lkp, projs]) => {
        setLookup(lkp)
        setProjects(projs)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadData()
  }, [companyFilter, projectFilter, dueStatusFilter])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { ordering: 'due_date' }
      if (companyFilter) params.company = companyFilter
      if (projectFilter) params.project = projectFilter
      if (dueStatusFilter) params.due_status = dueStatusFilter

      const sumParams: Record<string, string> = {}
      if (companyFilter) sumParams.company = companyFilter
      if (projectFilter) sumParams.project = projectFilter

      const [taskList, sumData, calData] = await Promise.all([
        tasksApi.listTasks(params),
        tasksApi.getOverdueSummary(sumParams),
        tasksApi.getWorkingCalendar(companyFilter || undefined).catch(() => null),
      ])
      setTasks(taskList)
      setSummary(sumData)
      const activeCal = calData || sumData.working_calendar
      setCalendarCfg(activeCal)
      if (activeCal) {
        setCalDays(activeCal.working_days)
        setCalHolidays(activeCal.holidays)
        setCalHours(String(activeCal.hours_per_day))
        setCalDueSoon(String(activeCal.due_soon_days))
        setCalReminderDays(String(activeCal.deadline_reminder_days))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar schedule')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckDeadlines() {
    setScanning(true)
    setError(null)
    setBanner(null)
    try {
      const res = await tasksApi.checkDeadlines({
        company: companyFilter || undefined,
        project: projectFilter || undefined,
      })
      setBanner(
        `Deadline scan complete (${res.as_of_date}): ${res.overdue_tasks_found} overdue, ${res.upcoming_deadlines_found} upcoming deadline(s), ${res.dependency_warnings_sent} dependency delay warning(s), ${res.notifications_created} new notification(s) dispatched.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan deadlines')
    } finally {
      setScanning(false)
    }
  }

  function toggleCalDay(dayIdx: number) {
    setCalDays((prev) =>
      prev.includes(dayIdx)
        ? prev.length > 1
          ? prev.filter((d) => d !== dayIdx)
          : prev
        : [...prev, dayIdx].sort((a, b) => a - b),
    )
  }

  function handleAddHoliday() {
    if (!newHolidayDate) return
    if (!calHolidays.includes(newHolidayDate)) {
      setCalHolidays((prev) => [...prev, newHolidayDate].sort())
    }
    setNewHolidayDate('')
  }

  async function handleSaveCalendar(e: FormEvent) {
    e.preventDefault()
    setCalSaving(true)
    setError(null)
    setBanner(null)
    try {
      const updated = await tasksApi.updateWorkingCalendar({
        company: companyFilter || calendarCfg?.company_id || undefined,
        working_days: calDays,
        holidays: calHolidays,
        hours_per_day: Number(calHours) || 8,
        due_soon_days: Number(calDueSoon),
        deadline_reminder_days: Number(calReminderDays),
      })
      setCalendarCfg(updated)
      setShowCalModal(false)
      setBanner(
        `Working calendar updated (${updated.working_day_labels.join(', ')}, ${updated.holidays.length} holiday(s), due-soon threshold ${updated.due_soon_days}d).`,
      )
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save working calendar')
    } finally {
      setCalSaving(false)
    }
  }

  const groupedTasks = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    let key = 'Unscheduled'
    if (t.due_date) {
      if (viewMode === 'daily') key = t.due_date
      else if (viewMode === 'weekly') key = getWeekBucket(t.due_date)
      else key = getMonthBucket(t.due_date)
    }
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const orderedGroupEntries = Object.entries(groupedTasks).sort(([a], [b]) => {
    if (a === 'Unscheduled') return 1
    if (b === 'Unscheduled') return -1
    return 0
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §7.10, §12.3 &amp; §20.1 · Schedule, Overdue &amp; Working Calendar</p>
          <h1>Task Due-Date &amp; Overdue Calendar</h1>
          <p>
            Track daily, weekly, and monthly deadlines, working-day overdue severity, and dependency
            blockers across projects.
          </p>
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowCalModal(true)}
          >
            Working Calendar Settings
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={scanning}
            onClick={handleCheckDeadlines}
          >
            {scanning ? 'Scanning Deadlines...' : 'Scan Deadlines & Send Alerts'}
          </button>
          <Link to="/tasks" className="btn">
            Back to Task List
          </Link>
        </div>
      </div>

      {summary && (
        <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-label">Overdue Tasks</div>
            <div className="stat-value" style={{ color: '#991b1b' }}>
              {summary.kpis.overdue_count}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              {summary.kpis.critical_overdue_count} Critical · {summary.kpis.high_overdue_count} High
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Due Today</div>
            <div className="stat-value">{summary.kpis.due_today_count}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              As of {summary.as_of_date}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Due Soon</div>
            <div className="stat-value">{summary.kpis.due_soon_count}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              Within {summary.working_calendar.due_soon_days} calendar day(s)
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Dependency Blocked</div>
            <div className="stat-value" style={{ color: '#92400e' }}>
              {summary.kpis.dependency_blocked_count}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              {summary.kpis.at_risk_dependent_count} downstream task(s) at risk
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.86rem',
          }}
        >
          {error}
        </div>
      )}
      {banner && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.86rem',
          }}
        >
          {banner}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <div className="btn-row" style={{ gap: '0.25rem' }}>
              {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={viewMode === mode ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'daily' ? 'Daily' : mode === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value)
                setProjectFilter('')
              }}
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
              style={{ width: 'auto' }}
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects
                .filter((p) => !companyFilter || p.company === companyFilter)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
            </select>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={dueStatusFilter}
              onChange={(e) => setDueStatusFilter(e.target.value)}
            >
              <option value="">All Due Statuses</option>
              <option value="Overdue">Overdue</option>
              <option value="Due Today">Due Today</option>
              <option value="Due Soon">Due Soon</option>
              <option value="On Track">On Track</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {calendarCfg && (
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              <strong>Working Days:</strong> {calendarCfg.working_day_labels.join(', ')} ·{' '}
              <strong>Holidays:</strong> {calendarCfg.holidays.length} ·{' '}
              <strong>Reminders:</strong> {calendarCfg.deadline_reminder_days}d prior
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p>Loading calendar schedule...</p>
      ) : orderedGroupEntries.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            No tasks match the selected schedule filters.
          </p>
        </div>
      ) : (
        <div className="form-grid">
          {orderedGroupEntries.map(([bucketLabel, list]) => {
            const hasOverdue = list.some((t) => t.is_overdue)
            return (
              <div
                key={bucketLabel}
                className="card"
                style={{
                  borderColor: hasOverdue ? '#fecaca' : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.65rem',
                  }}
                >
                  <h3 style={{ margin: 0 }}>{bucketLabel}</h3>
                  <span className="badge">{list.length} task(s)</span>
                </div>
                {list.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '0.6rem 0',
                      borderBottom: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {t.title}
                      </Link>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                        <Link to={`/projects/${t.project}/timeline`}>{t.project_code}</Link> · Owner:{' '}
                        {t.task_owner_name || 'Unassigned'}
                        {viewMode !== 'daily' && t.due_date ? ` · Due ${t.due_date}` : ''}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '0.25rem',
                        flexShrink: 0,
                      }}
                    >
                      <span className="badge">{t.status}</span>
                      {t.is_overdue ? (
                        <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                          {t.days_overdue ?? Math.abs(t.days_remaining || 0)}d /{' '}
                          {t.working_days_overdue ?? 0} work d late
                        </span>
                      ) : t.due_status === 'Due Today' ? (
                        <span className="badge badge-medium" style={{ fontSize: '0.68rem' }}>
                          Due Today
                        </span>
                      ) : t.due_status === 'Due Soon' ? (
                        <span className="badge badge-high" style={{ fontSize: '0.68rem' }}>
                          {t.working_days_remaining ?? t.days_remaining} work d left
                        </span>
                      ) : null}
                      {t.is_dependency_blocked && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.68rem',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Dep. Blocked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Working Calendar Settings Modal (SRS §20.1 & §20.2) */}
      {showCalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <form
            className="card"
            onSubmit={handleSaveCalendar}
            style={{ width: '100%', maxWidth: '540px', margin: 0 }}
          >
            <p className="eyebrow">SRS §20.1 &amp; §20.2 · Company Calendar</p>
            <h2 style={{ marginTop: 0 }}>Working Days, Holidays &amp; Reminder Thresholds</h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
              Overdue working-day counts and deadline alerts for{' '}
              <strong>{calendarCfg?.company_name || 'Active Company'}</strong> use this calendar.
            </p>

            <div className="form-field" style={{ marginBottom: '0.85rem' }}>
              <label>Working Days</label>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {WEEKDAYS.map((wd) => {
                  const active = calDays.includes(wd.idx)
                  return (
                    <button
                      key={wd.idx}
                      type="button"
                      className={active ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                      onClick={() => toggleCalDay(wd.idx)}
                    >
                      {wd.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
              <div className="form-field">
                <label>Working Hours / Day</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  className="input"
                  value={calHours}
                  onChange={(e) => setCalHours(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Due Soon Window (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  className="input"
                  value={calDueSoon}
                  onChange={(e) => setCalDueSoon(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Deadline Reminder Window (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  className="input"
                  value={calReminderDays}
                  onChange={(e) => setCalReminderDays(e.target.value)}
                />
              </div>
            </div>

            <div className="form-field" style={{ marginBottom: '0.9rem' }}>
              <label>Company Holidays ({calHolidays.length})</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="date"
                  className="input"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                />
                <button type="button" className="btn btn-sm" onClick={handleAddHoliday}>
                  + Add Holiday
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {calHolidays.map((h) => (
                  <span
                    key={h}
                    className="badge"
                    style={{ cursor: 'pointer' }}
                    title="Click to remove holiday"
                    onClick={() => setCalHolidays((prev) => prev.filter((x) => x !== h))}
                  >
                    {h} ×
                  </span>
                ))}
                {calHolidays.length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    No holidays configured.
                  </span>
                )}
              </div>
            </div>

            <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowCalModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={calSaving}>
                {calSaving ? 'Saving...' : 'Save Working Calendar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
