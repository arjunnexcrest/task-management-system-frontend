import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'
import {
  type ProgressUpdateItem,
  type WorkLogReviewSummary,
  trackingApi,
} from '@/modules/tracking/api'

export function Page() {
  const [updates, setUpdates] = useState<ProgressUpdateItem[]>([])
  const [summary, setSummary] = useState<WorkLogReviewSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filter State
  const [filterProject, setFilterProject] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterHasBlockers, setFilterHasBlockers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Submit Daily Work Update Form State (SRS §9.1)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [selectedAuthorId, setSelectedAuthorId] = useState('')
  const [progressPct, setProgressPct] = useState('50')
  const [timeSpentMins, setTimeSpentMins] = useState('')
  const [workCompleted, setWorkCompleted] = useState('')
  const [remainingWork, setRemainingWork] = useState('')
  const [remarks, setRemarks] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [blockers, setBlockers] = useState('')
  const [markTaskBlocked, setMarkTaskBlocked] = useState(false)
  const [blockerImpact, setBlockerImpact] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High')
  const [submitting, setSubmitting] = useState(false)

  async function loadWorkLogs() {
    const params: Record<string, string> = {}
    if (filterProject) params.project = filterProject
    if (filterAuthor) params.author = filterAuthor
    if (filterDateFrom) params.date_from = filterDateFrom
    if (filterDateTo) params.date_to = filterDateTo
    if (filterHasBlockers) params.has_blockers = 'true'
    if (searchQuery.trim()) params.search = searchQuery.trim()

    const [updatesData, summaryData] = await Promise.all([
      trackingApi.listProgressUpdates(params),
      trackingApi.getWorkLogSummary(params),
    ])
    setUpdates(updatesData)
    setSummary(summaryData)
  }

  useEffect(() => {
    Promise.all([
      projectsApi.listProjects(),
      tasksApi.listTasks(),
      projectsApi.getLookup(),
    ])
      .then(([projList, taskList, lkp]) => {
        setProjects(projList)
        setTasks(taskList)
        setLookup(lkp)
        if (taskList.length > 0) {
          setSelectedTaskId(taskList[0].id)
          setProgressPct(String(Math.round(Number(taskList[0].progress || 0))))
        }
        if (lkp.users.length > 0) {
          setSelectedAuthorId(lkp.users[0].id)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load lookup data'))
  }, [])

  useEffect(() => {
    setLoading(true)
    loadWorkLogs()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load work logs'))
      .finally(() => setLoading(false))
  }, [filterProject, filterAuthor, filterDateFrom, filterDateTo, filterHasBlockers])

  async function handleSubmitUpdate(e: FormEvent) {
    e.preventDefault()
    if (!selectedTaskId) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await trackingApi.createProgressUpdate({
        task: selectedTaskId,
        author: selectedAuthorId || undefined,
        progress_percentage: Number(progressPct),
        time_spent_minutes: timeSpentMins ? Number(timeSpentMins) : null,
        work_completed: workCompleted.trim() || null,
        remaining_work: remainingWork.trim() || null,
        remarks: remarks.trim() || null,
        next_action: nextAction.trim() || null,
        blockers: blockers.trim() || null,
        mark_task_blocked: blockers.trim() ? markTaskBlocked : false,
        blocker_impact: blockerImpact,
      })
      setWorkCompleted('')
      setRemainingWork('')
      setRemarks('')
      setNextAction('')
      setBlockers('')
      setTimeSpentMins('')
      setMarkTaskBlocked(false)
      const refreshedTasks = await tasksApi.listTasks()
      setTasks(refreshedTasks)
      await loadWorkLogs()
      setSuccess('Daily work update and remarks recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit work update')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS §7.5, §9.1, §9.3 &amp; §9.4 · Employee Work Updates &amp; Manager Review</p>
          <h1>Daily Work Log &amp; Progress Review</h1>
          <p>
            Record daily progress updates, remarks, time spent, and blockers, and compare planned vs.
            completed work across employees and projects.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/tasks" className="btn">
            All Tasks
          </Link>
          <Link to="/tasks/mine" className="btn btn-primary">
            My Tasks
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

      {/* SRS §9.3 MANAGER WORK LOG REVIEW KPIs */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-label">Planned vs. Completed Work</div>
            <div className="stat-value">
              {summary.planned_vs_completed.completed_tasks} / {summary.planned_vs_completed.total_tasks} Tasks
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Avg Task Progress: {summary.planned_vs_completed.average_task_progress}% · Avg Reported:{' '}
              {summary.planned_vs_completed.average_reported_progress}%
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Estimated vs. Actual Effort</div>
            <div className="stat-value">
              {summary.effort_comparison.total_actual_hours}h /{' '}
              {summary.effort_comparison.total_estimated_hours}h
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Logged in Updates: {summary.effort_comparison.total_logged_minutes} mins (Variance:{' '}
              {summary.effort_comparison.variance_hours >= 0 ? '+' : ''}
              {summary.effort_comparison.variance_hours}h)
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Approved Deliverables</div>
            <div className="stat-value">
              {summary.deliverables_comparison.approved_or_completed_tasks} /{' '}
              {summary.deliverables_comparison.approval_required_tasks}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Pending Review: {summary.deliverables_comparison.pending_approval_tasks} task(s)
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Delayed Work &amp; Blockers</div>
            <div className="stat-value">
              {summary.delayed_tasks_metrics.time_spent_on_delayed_hours}h on Delayed
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              {summary.delayed_tasks_metrics.delayed_tasks_count} delayed task(s) ·{' '}
              {summary.blockers_reported_count} blocker report(s)
            </div>
          </div>
        </div>
      )}

      {/* SRS §9.1 RECORD DAILY WORK UPDATE FORM */}
      <form className="card" onSubmit={handleSubmitUpdate} style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ marginTop: 0 }}>Record Daily Work Update &amp; Remarks (SRS §9.1)</h2>
        <div className="form-grid">
          <div className="form-field">
            <label>Related Task / Subtask</label>
            <select
              className="select"
              value={selectedTaskId}
              onChange={(e) => {
                const tid = e.target.value
                setSelectedTaskId(tid)
                const found = tasks.find((t) => t.id === tid)
                if (found) {
                  setProgressPct(String(Math.round(Number(found.progress || 0))))
                }
              }}
              required
            >
              <option value="">Select task...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.project_code}] {t.is_subtask ? '↳ ' : ''}
                  {t.title} ({t.status} · {Number(t.progress).toFixed(0)}%)
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Employee / Author</label>
            <select
              className="select"
              value={selectedAuthorId}
              onChange={(e) => setSelectedAuthorId(e.target.value)}
            >
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Progress Percentage ({progressPct}%)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressPct}
                onChange={(e) => setProgressPct(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="0"
                max="100"
                className="input"
                style={{ width: '80px' }}
                value={progressPct}
                onChange={(e) => setProgressPct(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label>Time Spent (Minutes)</label>
            <input
              type="number"
              min="0"
              step="5"
              className="input"
              placeholder="e.g. 120"
              value={timeSpentMins}
              onChange={(e) => setTimeSpentMins(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Work Performed (`work_completed`)</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Describe what was accomplished today..."
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Remaining Work (`remaining_work`)</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Describe remaining steps..."
              value={remainingWork}
              onChange={(e) => setRemainingWork(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Remarks (`remarks`)</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Additional remarks or context for reviewers/managers..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Next Action &amp; Blockers</label>
            <input
              className="input"
              placeholder="Next planned action..."
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              style={{ marginBottom: '0.45rem' }}
            />
            <input
              className="input"
              placeholder="Blocker description (leave empty if none)..."
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
            />
            {blockers.trim() && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={markTaskBlocked}
                    onChange={(e) => setMarkTaskBlocked(e.target.checked)}
                  />
                  <span>Transition task to Blocked</span>
                </label>
                <select
                  className="select"
                  style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                  value={blockerImpact}
                  onChange={(e) =>
                    setBlockerImpact(e.target.value as 'Low' | 'Medium' | 'High' | 'Critical')
                  }
                >
                  <option value="Low">Impact: Low</option>
                  <option value="Medium">Impact: Medium</option>
                  <option value="High">Impact: High</option>
                  <option value="Critical">Impact: Critical</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: '0.9rem' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : '+ Record Daily Work Update'}
          </button>
        </div>
      </form>

      {/* SRS §9.3 EMPLOYEE WORKLOAD COMPARISON TABLE */}
      {summary && summary.employee_workload.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginTop: 0 }}>Employee Work Update &amp; Effort Comparison (SRS §9.3)</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Updates Submitted</th>
                  <th>Distinct Tasks</th>
                  <th>Total Time Logged</th>
                  <th>Avg Reported Progress</th>
                  <th>Blockers Reported</th>
                </tr>
              </thead>
              <tbody>
                {summary.employee_workload.map((ew) => (
                  <tr key={ew.author_id}>
                    <td>
                      <strong>{ew.author_name}</strong>
                    </td>
                    <td>{ew.updates_count}</td>
                    <td>{ew.tasks_count}</td>
                    <td>
                      {ew.total_hours}h ({ew.total_minutes} mins)
                    </td>
                    <td>
                      <span className="badge badge-active">{ew.average_reported_progress}%</span>
                    </td>
                    <td>
                      {ew.blockers_count > 0 ? (
                        <span className="badge badge-critical">{ew.blockers_count}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FILTERS & CHRONOLOGICAL PROGRESS UPDATES FEED */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ margin: 0 }}>Work Update History ({updates.length})</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input"
              style={{ width: '200px' }}
              placeholder="Search remarks, work..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadWorkLogs()}
            />
            <select
              className="select"
              style={{ width: 'auto' }}
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value)}
            >
              <option value="">All Employees</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              title="From Date"
            />
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              title="To Date"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={filterHasBlockers}
                onChange={(e) => setFilterHasBlockers(e.target.checked)}
              />
              <span>Blockers Only</span>
            </label>
          </div>
        </div>

        {loading ? (
          <p>Loading work updates...</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {updates.map((pu) => (
              <div
                key={pu.id}
                style={{
                  padding: '1rem',
                  borderRadius: '0.6rem',
                  border: pu.blockers ? '1px solid #fecaca' : '1px solid var(--line)',
                  background: pu.blockers ? '#fffafa' : '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.55rem',
                  }}
                >
                  <div>
                    <Link
                      to={`/tasks/${pu.task}`}
                      style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.96rem' }}
                    >
                      {pu.task_title}
                    </Link>{' '}
                    {pu.project_code && (
                      <span className="badge" style={{ marginLeft: '0.25rem' }}>
                        {pu.project_code}
                      </span>
                    )}
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                      Updated by <strong>{pu.author_name}</strong> ·{' '}
                      {new Date(pu.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span className="badge badge-active">
                      {Number(pu.progress_percentage).toFixed(0)}% Reported
                    </span>
                    {pu.time_spent_minutes !== null && pu.time_spent_minutes > 0 && (
                      <span className="badge badge-in-progress">
                        {pu.time_spent_minutes}m ({(pu.time_spent_minutes / 60).toFixed(1)}h)
                      </span>
                    )}
                    {pu.blockers && <span className="badge badge-critical">Blocker</span>}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.65rem',
                    fontSize: '0.85rem',
                  }}
                >
                  {pu.work_completed && (
                    <div>
                      <strong style={{ color: 'var(--muted)', fontSize: '0.74rem', display: 'block' }}>
                        WORK COMPLETED
                      </strong>
                      {pu.work_completed}
                    </div>
                  )}
                  {pu.remaining_work && (
                    <div>
                      <strong style={{ color: 'var(--muted)', fontSize: '0.74rem', display: 'block' }}>
                        REMAINING WORK
                      </strong>
                      {pu.remaining_work}
                    </div>
                  )}
                  {pu.remarks && (
                    <div>
                      <strong style={{ color: 'var(--muted)', fontSize: '0.74rem', display: 'block' }}>
                        REMARKS
                      </strong>
                      {pu.remarks}
                    </div>
                  )}
                  {pu.next_action && (
                    <div>
                      <strong style={{ color: 'var(--muted)', fontSize: '0.74rem', display: 'block' }}>
                        NEXT ACTION
                      </strong>
                      {pu.next_action}
                    </div>
                  )}
                </div>

                {pu.blockers && (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      background: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '0.83rem',
                    }}
                  >
                    <strong>Blocker:</strong> {pu.blockers}
                  </div>
                )}
              </div>
            ))}
            {updates.length === 0 && (
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                No progress updates match the selected filters.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
