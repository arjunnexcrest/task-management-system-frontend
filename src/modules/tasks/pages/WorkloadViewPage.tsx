import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), tasksApi.listTasks()])
      .then(([lkp, tList]) => {
        setLookup(lkp)
        setTasks(tList)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Module 7 & 10 · Assignment Workload Distribution</p>
          <h1>Employee & Team Workload</h1>
          <p>Live distribution of active `task_assignments` across users and teams.</p>
        </div>
        <Link to="/tasks" className="btn">
          Back to Tasks
        </Link>
      </div>

      {loading ? (
        <p>Loading workload metrics...</p>
      ) : (
        <div className="form-grid">
          <div className="card">
            <h3>Employee Assignment Load</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Assigned Tasks</th>
                  <th>Est. Effort</th>
                </tr>
              </thead>
              <tbody>
                {lookup?.users.map((u) => {
                  const userTasks = tasks.filter(
                    (t) =>
                      t.task_owner === u.id ||
                      t.active_assignments.some((a) => a.user_id === u.id),
                  )
                  const totalHours = userTasks.reduce(
                    (sum, t) => sum + Number(t.estimated_effort || 0),
                    0,
                  )
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.full_name}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{u.email}</div>
                      </td>
                      <td>{u.designation || '—'}</td>
                      <td>
                        <span className="badge badge-in-progress">{userTasks.length} tasks</span>
                      </td>
                      <td>{totalHours.toFixed(1)} hrs</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Team Assignment Load</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Code</th>
                  <th>Active Team Tasks</th>
                </tr>
              </thead>
              <tbody>
                {lookup?.teams.map((tm) => {
                  const teamTasks = tasks.filter(
                    (t) =>
                      t.team === tm.id ||
                      t.active_assignments.some((a) => a.team_id === tm.id),
                  )
                  return (
                    <tr key={tm.id}>
                      <td>
                        <strong>{tm.name}</strong>
                      </td>
                      <td>{tm.code}</td>
                      <td>
                        <span className="badge badge-active">{teamTasks.length} tasks</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
