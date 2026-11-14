import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type LookupData, type Project, type ProjectPhase, projectsApi } from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [parentTasks, setParentTasks] = useState<Task[]>([])

  const [project, setProject] = useState(searchParams.get('project') || '')
  const [parentTask, setParentTask] = useState(searchParams.get('parent') || '')
  const [phase, setPhase] = useState('')
  const [department, setDepartment] = useState('')
  const [team, setTeam] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [taskOwner, setTaskOwner] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [priority, setPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High')
  const [status, setStatus] = useState<Task['status']>('To Do')
  const [progressMethod, setProgressMethod] = useState<'Manual' | 'Subtasks' | 'Checklist'>('Manual')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedEffort, setEstimatedEffort] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), projectsApi.listProjects()]).then(([lkp, projs]) => {
      setLookup(lkp)
      setProjects(projs)
      if (!project && projs.length > 0) {
        setProject(projs[0].id)
      }
      if (lkp.users.length > 0 && !taskOwner) {
        setTaskOwner(lkp.users[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!project) return
    projectsApi.listPhases(project).then(setPhases)
    tasksApi.listTasks({ project }).then((list) => {
      setParentTasks(list.filter((t) => !t.is_subtask && t.id !== id))
    })
  }, [project, id])

  useEffect(() => {
    if (!id) return
    tasksApi.getTask(id).then((t) => {
      setProject(t.project)
      setParentTask(t.parent_task || '')
      setPhase(t.phase || '')
      setDepartment(t.department || '')
      setTeam(t.team || '')
      setTitle(t.title)
      setDescription(t.description || '')
      setTaskOwner(t.task_owner || '')
      setReviewer(t.reviewer || '')
      setPriority(t.priority)
      setStatus(t.status)
      setProgressMethod(t.progress_method)
      setStartDate(t.start_date || '')
      setDueDate(t.due_date || '')
      setEstimatedEffort(t.estimated_effort ? String(t.estimated_effort) : '')
    })
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload: Partial<Task> = {
        project,
        parent_task: parentTask || null,
        phase: phase || null,
        department: department || null,
        team: team || null,
        title,
        description: description || null,
        task_owner: taskOwner || null,
        reviewer: reviewer || null,
        priority,
        status,
        progress_method: progressMethod,
        start_date: startDate || null,
        due_date: dueDate || null,
        estimated_effort: estimatedEffort ? Number(estimatedEffort) : null,
      }
      if (isEdit && id) {
        await tasksApi.updateTask(id, payload)
        navigate(`/tasks/${id}`)
      } else {
        const created = await tasksApi.createTask(payload)
        navigate(`/tasks/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Module 7 · Task & Subtask Authoring</p>
          <h1>{isEdit ? 'Edit Task' : parentTask ? 'Create Subtask' : 'Create Task'}</h1>
          <p>
            Uses the unified `tasks` table (`parent_task_id` for subtasks) per the official Database Design.
          </p>
        </div>
        <Link to="/tasks" className="btn">
          Back to Task List
        </Link>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        {error && <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error}</p>}
        <div className="form-grid">
          <div className="form-field">
            <label>Project *</label>
            <select
              className="select"
              required
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Parent Task (Leave blank for Top-Level Task)</label>
            <select
              className="select"
              value={parentTask}
              onChange={(e) => setParentTask(e.target.value)}
            >
              <option value="">None (Top-Level Task)</option>
              {parentTasks.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Title *</label>
            <input
              className="input"
              required
              placeholder="Task or subtask title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Project Phase</label>
            <select className="select" value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">None</option>
              {phases.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Department</label>
            <select
              className="select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">None</option>
              {lookup?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Team</label>
            <select className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">None</option>
              {lookup?.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Task Owner</label>
            <select
              className="select"
              value={taskOwner}
              onChange={(e) => setTaskOwner(e.target.value)}
            >
              <option value="">Unassigned</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Reviewer</label>
            <select
              className="select"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            >
              <option value="">None</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Priority</label>
            <select
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="form-field">
            <label>Status</label>
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Task['status'])}
            >
              <option value="Backlog">Backlog</option>
              <option value="To Do">To Do</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Blocked">Blocked</option>
              <option value="In Review">In Review</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="form-field">
            <label>Progress Calculation Method</label>
            <select
              className="select"
              value={progressMethod}
              onChange={(e) => setProgressMethod(e.target.value as typeof progressMethod)}
            >
              <option value="Manual">Manual</option>
              <option value="Subtasks">Subtasks Auto-Rollup</option>
              <option value="Checklist">Checklist Auto-Rollup</option>
            </select>
          </div>

          <div className="form-field">
            <label>Estimated Effort (Hours)</label>
            <input
              type="number"
              step="0.5"
              className="input"
              value={estimatedEffort}
              onChange={(e) => setEstimatedEffort(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Start Date</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Due Date</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field" style={{ marginTop: '1rem' }}>
          <label>Description</label>
          <textarea
            className="textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="btn-row" style={{ marginTop: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  )
}
