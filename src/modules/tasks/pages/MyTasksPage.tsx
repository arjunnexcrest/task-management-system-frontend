import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type LookupData, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), tasksApi.listTasks()])
      .then(([lkp, tList]) => {
        setLookup(lkp)
        setTasks(tList)
        if (lkp.users.length > 0) {
          setSelectedUser(lkp.users[0].id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredTasks = selectedUser
    ? tasks.filter(
        (t) =>
          t.task_owner === selectedUser ||
          t.active_assignments.some((a) => a.user_id === selectedUser),
      )
    : tasks

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Module 7 · Personal Assignment Workspace</p>
          <h1>My Assigned & Owned Tasks</h1>
          <p>View tasks and subtasks assigned to a specific employee via `task_assignments`.</p>
        </div>
        <div className="btn-row">
          <select
            className="select"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">All Employees</option>
            {lookup?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading assigned tasks...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task / Subtask</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {t.is_subtask ? `↳ ${t.title}` : t.title}
                    </Link>
                  </td>
                  <td>{t.project_code}</td>
                  <td>
                    <span className="badge badge-in-progress">{t.status}</span>
                  </td>
                  <td>
                    <span className="badge">{t.priority}</span>
                  </td>
                  <td>{t.due_date || '—'}</td>
                  <td>{Number(t.progress).toFixed(0)}%</td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={6}>No tasks assigned to this employee.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
