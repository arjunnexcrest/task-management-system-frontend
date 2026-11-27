import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type ProjectDetail, projectsApi } from '@/modules/projects/api'
import {
  type ProjectDependencyGraphNode,
  type ProjectDependencyGraphResponse,
  tasksApi,
} from '@/modules/tasks/api'

function toUtcMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const parts = iso.slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  return Date.UTC(parts[0], parts[1] - 1, parts[2])
}

const DAY_MS = 24 * 60 * 60 * 1000

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [graph, setGraph] = useState<ProjectDependencyGraphResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  async function loadTimeline() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [proj, graphRes] = await Promise.all([
        projectsApi.getProject(id),
        tasksApi.getDependencyGraph(id),
      ])
      setProject(proj)
      setGraph(graphRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project timeline')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTimeline()
  }, [id])

  async function handleRunProjectScan() {
    if (!id) return
    setScanning(true)
    setScanMsg(null)
    setError(null)
    try {
      const res = await tasksApi.checkDeadlines({ project: id })
      setScanMsg(
        `Project deadline scan complete: ${res.overdue_tasks_found} overdue, ${res.upcoming_deadlines_found} upcoming, ${res.dependency_warnings_sent} dependency warning(s), ${res.notifications_created} notification(s) sent.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan project deadlines')
    } finally {
      setScanning(false)
    }
  }

  const timelineBounds = useMemo(() => {
    const timestamps: number[] = []
    const todayMs = toUtcMs(graph?.as_of_date || new Date().toISOString().slice(0, 10))
    if (todayMs) timestamps.push(todayMs)

    if (project) {
      const ps = toUtcMs(project.start_date)
      const pe = toUtcMs(project.planned_completion_date)
      if (ps) timestamps.push(ps)
      if (pe) timestamps.push(pe)
      project.phases.forEach((ph) => {
        const s = toUtcMs(ph.start_date)
        const e = toUtcMs(ph.end_date)
        if (s) timestamps.push(s)
        if (e) timestamps.push(e)
      })
      project.milestones.forEach((ms) => {
        const t = toUtcMs(ms.target_date)
        if (t) timestamps.push(t)
      })
    }
    if (graph) {
      graph.nodes.forEach((n) => {
        const s = toUtcMs(n.start_date)
        const e = toUtcMs(n.due_date)
        if (s) timestamps.push(s)
        if (e) timestamps.push(e)
      })
    }

    const minMs = timestamps.length > 0 ? Math.min(...timestamps) - 2 * DAY_MS : Date.now() - 7 * DAY_MS
    const maxMs = timestamps.length > 0 ? Math.max(...timestamps) + 2 * DAY_MS : Date.now() + 21 * DAY_MS
    const spanMs = Math.max(DAY_MS * 7, maxMs - minMs)
    const todayPct = todayMs ? Math.max(0, Math.min(100, ((todayMs - minMs) / spanMs) * 100)) : null
    return {
      minMs,
      maxMs: minMs + spanMs,
      spanMs,
      todayPct,
      minLabel: new Date(minMs).toISOString().slice(0, 10),
      maxLabel: new Date(minMs + spanMs).toISOString().slice(0, 10),
    }
  }, [project, graph])

  function getBarGeometry(startIso: string | null | undefined, endIso: string | null | undefined) {
    const s = toUtcMs(startIso)
    const e = toUtcMs(endIso)
    if (!s && !e) return null
    const effStart = s ?? (e! - 2 * DAY_MS)
    const effEnd = Math.max(effStart + DAY_MS, (e ?? effStart) + DAY_MS)
    const leftPct = Math.max(0, Math.min(98, ((effStart - timelineBounds.minMs) / timelineBounds.spanMs) * 100))
    const widthPct = Math.max(2, Math.min(100 - leftPct, ((effEnd - effStart) / timelineBounds.spanMs) * 100))
    return { leftPct, widthPct }
  }

  function barColor(node: ProjectDependencyGraphNode) {
    if (node.status === 'Completed') return '#059669'
    if (node.is_overdue) return '#dc2626'
    if (node.is_dependency_blocked || node.status === 'Blocked') return '#d97706'
    return '#1e3a8a'
  }

  if (loading) return <p className="page-container">Loading project timeline &amp; dependency graph...</p>
  if (!project) return <p className="page-container">Project not found.</p>

  const sortedNodes = [...(graph?.nodes || [])].sort(
    (a, b) =>
      a.topological_level - b.topological_level ||
      (a.start_date || a.due_date || '9999').localeCompare(b.start_date || b.due_date || '9999'),
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {project.code} · SRS §7.9 &amp; §12.4 Project Gantt Timeline &amp; Dependencies
          </p>
          <h1>{project.name} — Timeline &amp; Dependency Graph</h1>
          <p>
            Schedule window: {project.start_date || 'TBD'} → {project.planned_completion_date || 'TBD'}
            {graph?.working_calendar
              ? ` · Working days: ${graph.working_calendar.working_day_labels.join(', ')}`
              : ''}
          </p>
        </div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            disabled={scanning}
            onClick={handleRunProjectScan}
          >
            {scanning ? 'Scanning...' : 'Scan Project Deadlines'}
          </button>
          <Link to={`/tasks/new?project=${project.id}`} className="btn btn-primary">
            + Add Task
          </Link>
          <Link to={`/projects/${project.id}`} className="btn">
            Back to Project Overview
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
      {scanMsg && (
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
          {scanMsg}
        </div>
      )}

      {graph && (
        <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-label">Scheduled Tasks</div>
            <div className="stat-value">{graph.summary.total_tasks}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              {graph.summary.total_dependencies} dependency link(s)
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overdue Tasks</div>
            <div className="stat-value" style={{ color: '#991b1b' }}>
              {graph.summary.overdue_tasks_count}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              {graph.summary.at_risk_dependents_count} downstream task(s) at risk
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Dependency Blocked</div>
            <div className="stat-value" style={{ color: '#92400e' }}>
              {graph.summary.blocked_tasks_count}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              Waiting on prerequisites
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Schedule Conflicts</div>
            <div className="stat-value" style={{ color: graph.summary.schedule_conflicts_count > 0 ? '#991b1b' : undefined }}>
              {graph.summary.schedule_conflicts_count}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              {graph.summary.warnings_count} total manager warning(s)
            </div>
          </div>
        </div>
      )}

      {/* Manager Delay & Schedule Conflict Warnings Panel (SRS §7.9) */}
      {graph && graph.warnings.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            background: '#fffafa',
            borderColor: '#fecaca',
          }}
        >
          <p className="eyebrow" style={{ color: '#991b1b' }}>
            SRS §7.9 · Dependency Delay &amp; Schedule Conflict Warnings
          </p>
          <h3 style={{ marginTop: 0, color: '#991b1b' }}>
            Active Manager Alerts ({graph.warnings.length})
          </h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {graph.warnings.map((w, idx) => (
              <div
                key={`${w.source_task_id}-${w.affected_task_id}-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.45rem',
                  background: '#ffffff',
                  border: '1px solid #fecaca',
                  fontSize: '0.84rem',
                }}
              >
                <div>
                  <span
                    className={
                      w.severity === 'Critical' ? 'badge badge-critical' : 'badge badge-high'
                    }
                    style={{ marginRight: '0.45rem', fontSize: '0.7rem' }}
                  >
                    {w.severity} · {w.reason}
                  </span>
                  <Link to={`/tasks/${w.source_task_id}`} style={{ fontWeight: 600 }}>
                    {w.source_task_title}
                  </Link>{' '}
                  →{' '}
                  <Link to={`/tasks/${w.affected_task_id}`} style={{ fontWeight: 600 }}>
                    {w.affected_task_title}
                  </Link>{' '}
                  <span className="badge" style={{ fontSize: '0.7rem' }}>
                    {w.dependency_type}
                  </span>
                  <div style={{ fontSize: '0.77rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                    {w.message}
                  </div>
                </div>
                {w.slip_days > 0 && (
                  <span className="badge badge-critical" style={{ fontSize: '0.72rem' }}>
                    {w.slip_days}d slip
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Gantt Schedule Bars */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Gantt Timeline — Phases, Milestones &amp; Tasks</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Window: {timelineBounds.minLabel} → {timelineBounds.maxLabel} · Vertical dashed line marks
              Today ({graph?.as_of_date})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            <span>
              <strong style={{ color: '#1e3a8a' }}>■</strong> Active
            </span>
            <span>
              <strong style={{ color: '#059669' }}>■</strong> Completed
            </span>
            <span>
              <strong style={{ color: '#d97706' }}>■</strong> Dep. Blocked
            </span>
            <span>
              <strong style={{ color: '#dc2626' }}>■</strong> Overdue
            </span>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: '230px' }}>Work Item &amp; Tier</th>
              <th>Dates</th>
              <th>Status &amp; Risk</th>
              <th style={{ minWidth: '280px' }}>Schedule Bar</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {project.phases.map((ph) => {
              const geom = getBarGeometry(ph.start_date, ph.end_date)
              return (
                <tr key={`ph-${ph.id}`} style={{ background: '#f8fafc' }}>
                  <td>
                    <strong>{ph.name}</strong>{' '}
                    <span className="badge badge-medium" style={{ fontSize: '0.68rem' }}>
                      Phase
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>
                    {ph.start_date || '—'} → {ph.end_date || '—'}
                  </td>
                  <td>
                    <span className="badge">{ph.status}</span>
                  </td>
                  <td>
                    <div
                      style={{
                        position: 'relative',
                        height: '18px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      {timelineBounds.todayPct !== null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${timelineBounds.todayPct}%`,
                            top: 0,
                            bottom: 0,
                            borderLeft: '2px dashed #475569',
                            zIndex: 2,
                          }}
                        />
                      )}
                      {geom && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${geom.leftPct}%`,
                            width: `${geom.widthPct}%`,
                            top: '3px',
                            height: '12px',
                            background: '#64748b',
                            borderRadius: '3px',
                          }}
                          title={`${ph.name}: ${ph.start_date || '?'} → ${ph.end_date || '?'}`}
                        />
                      )}
                    </div>
                  </td>
                  <td>{Number(ph.progress).toFixed(0)}%</td>
                </tr>
              )
            })}

            {project.milestones.map((ms) => {
              const msMs = toUtcMs(ms.target_date)
              const leftPct = msMs
                ? Math.max(0, Math.min(97, ((msMs - timelineBounds.minMs) / timelineBounds.spanMs) * 100))
                : null
              return (
                <tr key={`ms-${ms.id}`}>
                  <td>
                    <strong>◆ {ms.title}</strong>{' '}
                    <span className="badge badge-active" style={{ fontSize: '0.68rem' }}>
                      Milestone
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>Target: {ms.target_date}</td>
                  <td>
                    <span className="badge">{ms.status}</span>{' '}
                    {ms.is_overdue && (
                      <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                        Overdue ({Math.abs(ms.days_remaining || 0)}d)
                      </span>
                    )}
                  </td>
                  <td>
                    <div
                      style={{
                        position: 'relative',
                        height: '18px',
                        background: '#f1f5f9',
                        borderRadius: '4px',
                      }}
                    >
                      {timelineBounds.todayPct !== null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${timelineBounds.todayPct}%`,
                            top: 0,
                            bottom: 0,
                            borderLeft: '2px dashed #475569',
                          }}
                        />
                      )}
                      {leftPct !== null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            top: '2px',
                            width: '13px',
                            height: '13px',
                            transform: 'rotate(45deg)',
                            background: ms.is_overdue ? '#dc2626' : '#0f766e',
                          }}
                          title={`Milestone: ${ms.title} (${ms.target_date})`}
                        />
                      )}
                    </div>
                  </td>
                  <td>{Number(ms.progress).toFixed(0)}%</td>
                </tr>
              )
            })}

            {sortedNodes.map((n) => {
              const geom = getBarGeometry(n.start_date, n.due_date)
              return (
                <tr key={`t-${n.id}`}>
                  <td>
                    <Link to={`/tasks/${n.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {n.is_subtask ? `↳ ${n.title}` : n.title}
                    </Link>
                    <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>
                      Tier {n.topological_level} · {n.task_owner_name || 'Unassigned'}
                      {n.upstream_count > 0 ? ` · ${n.upstream_count} prereq(s)` : ''}
                      {n.downstream_count > 0 ? ` · ${n.downstream_count} dependent(s)` : ''}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>
                    <div>
                      {n.start_date || '—'} → {n.due_date || '—'}
                    </div>
                    {n.planned_working_days && (
                      <div style={{ fontSize: '0.71rem', color: 'var(--muted)' }}>
                        {n.planned_working_days} working day(s)
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span className="badge">{n.status}</span>
                      {n.is_overdue && (
                        <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                          {n.days_overdue}d / {n.working_days_overdue}w late
                        </span>
                      )}
                      {n.is_dependency_blocked && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.68rem',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Dep. Blocked ({n.blocking_prerequisites_count})
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        position: 'relative',
                        height: '20px',
                        background: '#f1f5f9',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      {timelineBounds.todayPct !== null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${timelineBounds.todayPct}%`,
                            top: 0,
                            bottom: 0,
                            borderLeft: '2px dashed #475569',
                            zIndex: 2,
                          }}
                        />
                      )}
                      {geom ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${geom.leftPct}%`,
                            width: `${geom.widthPct}%`,
                            top: '3px',
                            height: '14px',
                            background: barColor(n),
                            borderRadius: '3px',
                            opacity: 0.9,
                          }}
                          title={`${n.title} (${n.start_date || 'TBD'} → ${n.due_date || 'TBD'}) · ${n.progress}%`}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--muted)',
                            paddingLeft: '0.4rem',
                            lineHeight: '20px',
                          }}
                        >
                          Unscheduled
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{Number(n.progress).toFixed(0)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Project Dependency Matrix */}
      {graph && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Task Dependency Matrix ({graph.edges.length} link(s))
          </h3>
          {graph.edges.length === 0 ? (
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.86rem' }}>
              No task dependencies defined in this project yet. Open any task detail page to link
              Finish-to-Start, Start-to-Start, Finish-to-Finish, or Start-to-Finish dependencies.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prerequisite Task</th>
                  <th>Type</th>
                  <th>Dependent Task</th>
                  <th>Rule Status</th>
                  <th>Schedule Alignment</th>
                </tr>
              </thead>
              <tbody>
                {graph.edges.map((edge) => {
                  const satisfied = edge.is_satisfied_for_start && edge.is_satisfied_for_complete
                  return (
                    <tr key={edge.id}>
                      <td>
                        <Link to={`/tasks/${edge.depends_on_task}`} style={{ fontWeight: 600 }}>
                          {edge.depends_on_title}
                        </Link>{' '}
                        <span className="badge" style={{ fontSize: '0.7rem' }}>
                          {edge.depends_on_status}
                        </span>
                      </td>
                      <td>
                        <span className="badge">{edge.dependency_type}</span>
                      </td>
                      <td>
                        <Link to={`/tasks/${edge.task}`} style={{ fontWeight: 600 }}>
                          {edge.task_title}
                        </Link>{' '}
                        <span className="badge" style={{ fontSize: '0.7rem' }}>
                          {edge.task_status}
                        </span>
                      </td>
                      <td>
                        {satisfied ? (
                          <span className="badge badge-active">Satisfied</span>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                            }}
                          >
                            Pending / Blocking
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {edge.has_schedule_conflict ? (
                          <span style={{ color: '#991b1b' }}>⚠ {edge.schedule_conflict}</span>
                        ) : (
                          <span style={{ color: '#065f46' }}>Aligned</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
