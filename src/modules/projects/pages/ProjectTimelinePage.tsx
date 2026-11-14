import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type ProjectDetail, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([projectsApi.getProject(id), tasksApi.listTasks({ project: id })])
      .then(([proj, tList]) => {
        setProject(proj)
        setTasks(tList)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p>Loading project timeline...</p>
  if (!project) return <p>Project not found.</p>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">{project.code} · Project Timeline & Schedule</p>
          <h1>{project.name} — Timeline</h1>
          <p>
            Schedule window: {project.start_date || 'TBD'} → {project.planned_completion_date || 'TBD'}
          </p>
        </div>
        <Link to={`/projects/${project.id}`} className="btn">
          Back to Project Overview
        </Link>
      </div>

      <div className="card">
        <h3>Phases, Milestones & Task Schedule</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Start Date</th>
              <th>Target / Due Date</th>
              <th>Status</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {project.phases.map((ph) => (
              <tr key={`ph-${ph.id}`}>
                <td>
                  <strong>{ph.name}</strong>
                </td>
                <td>
                  <span className="badge badge-medium">Phase</span>
                </td>
                <td>{ph.start_date || '—'}</td>
                <td>{ph.end_date || '—'}</td>
                <td>{ph.status}</td>
                <td>{Number(ph.progress).toFixed(0)}%</td>
              </tr>
            ))}
            {project.milestones.map((ms) => (
              <tr key={`ms-${ms.id}`}>
                <td>
                  <strong>🏁 {ms.title}</strong>
                </td>
                <td>
                  <span className="badge badge-active">Milestone</span>
                </td>
                <td>—</td>
                <td>{ms.target_date}</td>
                <td>{ms.status}</td>
                <td>{Number(ms.progress).toFixed(0)}%</td>
              </tr>
            ))}
            {tasks.map((t) => (
              <tr key={`t-${t.id}`}>
                <td>
                  <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {t.is_subtask ? `↳ ${t.title}` : t.title}
                  </Link>
                </td>
                <td>
                  <span className="badge">{t.is_subtask ? 'Subtask' : 'Task'}</span>
                </td>
                <td>{t.start_date || '—'}</td>
                <td>{t.due_date || '—'}</td>
                <td>{t.status}</td>
                <td>{Number(t.progress).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
