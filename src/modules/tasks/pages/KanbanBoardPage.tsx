import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Task, tasksApi } from '@/modules/tasks/api'

const KANBAN_STATUSES: Task['status'][] = [
  'To Do',
  'Assigned',
  'In Progress',
  'In Review',
  'Completed',
]

export function Page() {
  const [columns, setColumns] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)

  async function loadBoard() {
    setLoading(true)
    try {
      const data = await tasksApi.getKanban()
      setColumns(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoard()
  }, [])

  async function moveTask(taskId: string, newStatus: Task['status']) {
    await tasksApi.updateTask(taskId, { status: newStatus })
    await loadBoard()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Module 10 · Visual Execution Views</p>
          <h1>Interactive Kanban Board</h1>
          <p>Move tasks across workflow stages and inspect active user/team assignments.</p>
        </div>
        <div className="btn-row">
          <Link to="/tasks" className="btn">
            List View
          </Link>
          <Link to="/tasks/new" className="btn btn-primary">
            + Create Task
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Loading Kanban board...</p>
      ) : (
        <div className="kanban-grid">
          {KANBAN_STATUSES.map((status) => {
            const list = columns[status] || []
            return (
              <div key={status} className="kanban-col">
                <div className="kanban-col-header">
                  <span>{status}</span>
                  <span className="badge">{list.length}</span>
                </div>
                {list.map((t) => (
                  <div key={t.id} className="kanban-card">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        marginBottom: '0.3rem',
                      }}
                    >
                      <span>{t.project_code}</span>
                      <span className="badge">{t.priority}</span>
                    </div>
                    <Link
                      to={`/tasks/${t.id}`}
                      style={{ fontWeight: 700, color: 'var(--ink)', display: 'block' }}
                    >
                      {t.title}
                    </Link>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--muted)',
                        margin: '0.45rem 0',
                      }}
                    >
                      {t.active_assignments
                        .map((a) => (a.assignment_type === 'User' ? `👤 ${a.user_name}` : `👥 ${a.team_name}`))
                        .join(', ') || 'Unassigned'}
                    </div>
                    <div className="progress-track" style={{ marginBottom: '0.5rem' }}>
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Number(t.progress))}%` }}
                      />
                    </div>
                    <select
                      className="select"
                      style={{ width: '100%', padding: '0.3rem', fontSize: '0.78rem' }}
                      value={t.status}
                      onChange={(e) => moveTask(t.id, e.target.value as Task['status'])}
                    >
                      {KANBAN_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          Move to: {st}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
