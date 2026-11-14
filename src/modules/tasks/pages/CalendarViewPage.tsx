import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tasksApi
      .listTasks({ ordering: 'due_date' })
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [])

  const groupedByDate = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.due_date || 'Unscheduled'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Module 10 · Schedule View</p>
          <h1>Task Due-Date Calendar</h1>
          <p>Tasks and subtasks grouped chronologically by target due date.</p>
        </div>
        <Link to="/tasks" className="btn">
          Back to Task List
        </Link>
      </div>

      {loading ? (
        <p>Loading calendar schedule...</p>
      ) : (
        <div className="form-grid">
          {Object.entries(groupedByDate).map(([dueDate, list]) => (
            <div key={dueDate} className="card">
              <h3>📅 {dueDate}</h3>
              {list.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {t.title}
                  </Link>
                  <span className="badge">{t.status}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
