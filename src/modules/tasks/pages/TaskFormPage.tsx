import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  type LookupData,
  type Project,
  type ProjectPhase,
  projectsApi,
} from '@/modules/projects/api'
import { type Task, tasksApi } from '@/modules/tasks/api'

const TASK_STATUSES: Task['status'][] = [
  'Backlog',
  'To Do',
  'Assigned',
  'In Progress',
  'On Hold',
  'Blocked',
  'In Review',
  'Changes Requested',
  'Approved',
  'Completed',
  'Cancelled',
]

export function Page() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [projectTasks, setProjectTasks] = useState<Task[]>([])

  const [selectedCompany, setSelectedCompany] = useState('')
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
  const [progressMethod, setProgressMethod] = useState<'Manual' | 'Subtasks' | 'Checklist'>(
    'Manual',
  )
  const [progress, setProgress] = useState('0')
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedEffort, setEstimatedEffort] = useState('')

  // SRS §7.1 Multi-Assignee, Tags, Dependencies & Initial Checklists
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([])
  const [assigneeTeamIds, setAssigneeTeamIds] = useState<string[]>([])
  const [tagsInput, setTagsInput] = useState('')
  const [dependencyTaskIds, setDependencyTaskIds] = useState<string[]>([])
  const [checklistInput, setChecklistInput] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([projectsApi.getLookup(), projectsApi.listProjects()]).then(([lkp, projs]) => {
      setLookup(lkp)
      setProjects(projs)
      if (!isEdit) {
        const initialProjId = searchParams.get('project') || (projs[0]?.id ?? '')
        if (initialProjId) {
          setProject(initialProjId)
          const foundProj = projs.find((p) => p.id === initialProjId)
          if (foundProj) {
            setSelectedCompany(foundProj.company)
          }
        }
        if (lkp.users.length > 0 && !taskOwner) {
          setTaskOwner(lkp.users[0].id)
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!project) return
    const foundProj = projects.find((p) => p.id === project)
    if (foundProj && foundProj.company !== selectedCompany) {
      setSelectedCompany(foundProj.company)
    }
    projectsApi.listPhases(project).then(setPhases).catch(() => {})
    tasksApi
      .listTasks({ project })
      .then((list) => {
        setProjectTasks(list.filter((t) => t.id !== id))
      })
      .catch(() => {})
  }, [project, id, projects])

  useEffect(() => {
    if (!id) return
    tasksApi
      .getTask(id)
      .then((t) => {
        if (t.company_id) setSelectedCompany(t.company_id)
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
        setProgress(String(Number(t.progress || 0)))
        setApprovalRequired(Boolean(t.approval_required))
        setStartDate(t.start_date || '')
        setDueDate(t.due_date || '')
        setEstimatedEffort(t.estimated_effort ? String(t.estimated_effort) : '')
        setAssigneeUserIds(
          t.assignee_user_ids ||
            t.active_assignments
              .filter((a) => a.assignment_type === 'User' && a.user_id)
              .map((a) => String(a.user_id)),
        )
        setAssigneeTeamIds(
          t.assignee_team_ids ||
            t.active_assignments
              .filter((a) => a.assignment_type === 'Team' && a.team_id)
              .map((a) => String(a.team_id)),
        )
        setTagsInput((t.tag_names || t.tags || []).join(', '))
        setDependencyTaskIds(
          t.dependency_task_ids || t.dependencies.map((d) => d.depends_on_task),
        )
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load task for editing')
      })
  }, [id])

  function toggleSelection(list: string[], setter: (next: string[]) => void, item: string) {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item))
    } else {
      setter([...list, item])
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!project) {
      setError('Please select a parent project for this task.')
      return
    }
    if (!title.trim()) {
      setError('Task title is required.')
      return
    }
    if (startDate && dueDate && dueDate < startDate) {
      setError('Due date cannot be earlier than start date.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const parsedChecklist = checklistInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      const payload: Partial<Task> = {
        project,
        parent_task: parentTask || null,
        phase: phase || null,
        department: department || null,
        team: team || null,
        title: title.trim(),
        description: description.trim() || null,
        task_owner: taskOwner || null,
        reviewer: reviewer || null,
        priority,
        status,
        progress_method: progressMethod,
        progress: progressMethod === 'Manual' ? Number(progress || 0) : undefined,
        approval_required: approvalRequired,
        start_date: startDate || null,
        due_date: dueDate || null,
        estimated_effort: estimatedEffort ? Number(estimatedEffort) : null,
        assignee_user_ids: assigneeUserIds,
        assignee_team_ids: assigneeTeamIds,
        tag_names: parsedTags,
        dependency_task_ids: dependencyTaskIds,
      }

      if (!isEdit && parsedChecklist.length > 0) {
        payload.initial_checklist_items = parsedChecklist
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

  const currentProjectObj = projects.find((p) => p.id === project)
  const effectiveCompanyId = currentProjectObj?.company || selectedCompany
  const filteredProjects = selectedCompany
    ? projects.filter((p) => p.company === selectedCompany)
    : projects

  const companyDepts =
    lookup?.departments.filter((d) => !effectiveCompanyId || d.company_id === effectiveCompanyId) ||
    []
  const companyTeams =
    lookup?.teams.filter((tm) => {
      if (department) return tm.department_id === department
      if (effectiveCompanyId) return tm.company_id === effectiveCompanyId
      return true
    }) || []
  const companyUsers =
    lookup?.users.filter((u) => {
      if (
        effectiveCompanyId &&
        u.company_ids &&
        u.company_ids.length > 0 &&
        !u.company_ids.includes(effectiveCompanyId)
      ) {
        return false
      }
      return true
    }) || []

  const parentTaskCandidates = projectTasks.filter((t) => !t.is_subtask)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 5 (§7.1–§7.11) &amp; Module 6 (§8.1) · Task CRUD</p>
          <h1>
            {isEdit
              ? `Edit ${parentTask ? 'Subtask' : 'Task'}`
              : parentTask
                ? 'Create Subtask'
                : 'Create New Task'}
          </h1>
          <p>
            Configure project/company linkage, responsible department &amp; team, accountable owner,
            multiple assignees, schedule, effort, tags, and dependencies.
          </p>
        </div>
        <div className="btn-row">
          {isEdit && id && (
            <Link to={`/tasks/${id}`} className="btn">
              Task Details
            </Link>
          )}
          <Link to="/tasks" className="btn">
            Back to Task List
          </Link>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
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

        {/* Section 1: Hierarchy & Classification */}
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          1. Project Context, Hierarchy &amp; Core Identification
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Company</label>
            <select
              className="select"
              value={effectiveCompanyId}
              onChange={(e) => {
                const cid = e.target.value
                setSelectedCompany(cid)
                const firstProj = projects.find((p) => !cid || p.company === cid)
                if (firstProj) setProject(firstProj.id)
                setDepartment('')
                setTeam('')
              }}
            >
              <option value="">All Companies</option>
              {lookup?.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Parent Project *</label>
            <select
              className="select"
              required
              value={project}
              onChange={(e) => {
                setProject(e.target.value)
                setParentTask('')
                setPhase('')
              }}
            >
              <option value="">Select project...</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.company_code})
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
              <option value="">None (Top-Level Project Task)</option>
              {parentTaskCandidates.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.title} ({pt.status})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Project Phase (SRS §15.3)</label>
            <select className="select" value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">None</option>
              {phases.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.name} ({ph.status})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Task Title *</label>
            <input
              className="input"
              required
              placeholder="Enter clear, actionable task or subtask title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Detailed Task Instructions / Description</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Provide detailed instructions, acceptance criteria, and deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '1.25rem 0' }} />

        {/* Section 2: Ownership, Department, Team & Review */}
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          2. Organization Scope, Accountable Owner &amp; Review Rules
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Responsible Department</label>
            <select
              className="select"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value)
                setTeam('')
              }}
            >
              <option value="">None</option>
              {companyDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Responsible Team</label>
            <select className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">None</option>
              {companyTeams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name} ({tm.department_name || tm.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Task Owner (Primary Accountable Person — SRS §1.4 #3)</label>
            <select
              className="select"
              value={taskOwner}
              onChange={(e) => setTaskOwner(e.target.value)}
            >
              <option value="">Auto-assign from first Assignee / Unassigned</option>
              {companyUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Reviewer (SRS §7.1 &amp; §14.1)</label>
            <select
              className="select"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            >
              <option value="">None</option>
              {companyUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(e) => setApprovalRequired(e.target.checked)}
              />
              <span>
                Mandatory Review &amp; Approval Required before task can be marked Completed (SRS
                §7.1 &amp; §14.3)
              </span>
            </label>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '1.25rem 0' }} />

        {/* Section 3: Multiple Assignees (Users & Teams) */}
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          3. Assignees (Individual Employees &amp; Teams — SRS §7.2)
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Assigned Employees ({assigneeUserIds.length} selected)</label>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.65rem',
                maxHeight: '155px',
                overflowY: 'auto',
                background: '#f8fafc',
              }}
            >
              {companyUsers.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.28rem 0',
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assigneeUserIds.includes(u.id)}
                    onChange={() =>
                      toggleSelection(assigneeUserIds, setAssigneeUserIds, u.id)
                    }
                  />
                  <span>
                    <strong>{u.full_name}</strong>{' '}
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      ({u.designation || u.email})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>Assigned Teams ({assigneeTeamIds.length} selected)</label>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.65rem',
                maxHeight: '155px',
                overflowY: 'auto',
                background: '#f8fafc',
              }}
            >
              {companyTeams.map((tm) => (
                <label
                  key={tm.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.28rem 0',
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assigneeTeamIds.includes(tm.id)}
                    onChange={() =>
                      toggleSelection(assigneeTeamIds, setAssigneeTeamIds, tm.id)
                    }
                  />
                  <span>
                    <strong>{tm.name}</strong>{' '}
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      ({tm.department_name || tm.code})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '1.25rem 0' }} />

        {/* Section 4: Priority, Status, Schedule, Effort & Progress */}
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          4. Priority, Workflow Status, Schedule &amp; Progress Calculation
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Priority (SRS §7.4)</label>
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
            <label>Status (SRS §7.3 — 11 Default Statuses)</label>
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Task['status'])}
            >
              {TASK_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Start Date (Planned)</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Due Date (Deadline)</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Estimated Effort (Hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input"
              placeholder="e.g. 16.0"
              value={estimatedEffort}
              onChange={(e) => setEstimatedEffort(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Progress Calculation Method (SRS §7.6)</label>
            <select
              className="select"
              value={progressMethod}
              onChange={(e) => setProgressMethod(e.target.value as typeof progressMethod)}
            >
              <option value="Manual">Manual Percentage</option>
              <option value="Subtasks">Automatic from Subtasks</option>
              <option value="Checklist">Automatic from Checklist Items</option>
            </select>
          </div>

          {progressMethod === 'Manual' && (
            <div className="form-field">
              <label>Manual Progress Percentage (0–100%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="input"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            </div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '1.25rem 0' }} />

        {/* Section 5: Tags, Dependencies & Initial Checklist */}
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          5. Classification Tags, Prerequisite Dependencies &amp; Checklist
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Classification Tags (Comma-separated — SRS §7.1)</label>
            <input
              className="input"
              placeholder="e.g. backend, api, security, sprint-1"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>
              Prerequisite Task Dependencies ({dependencyTaskIds.length} selected — SRS §7.9)
            </label>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.65rem',
                maxHeight: '140px',
                overflowY: 'auto',
                background: '#f8fafc',
              }}
            >
              {projectTasks.map((pt) => (
                <label
                  key={pt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.25rem 0',
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dependencyTaskIds.includes(pt.id)}
                    onChange={() =>
                      toggleSelection(dependencyTaskIds, setDependencyTaskIds, pt.id)
                    }
                  />
                  <span>
                    <strong>{pt.title}</strong>{' '}
                    <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      ({pt.status})
                    </span>
                  </span>
                </label>
              ))}
              {projectTasks.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  No other tasks in this project yet.
                </span>
              )}
            </div>
          </div>

          {!isEdit && (
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Initial Checklist Steps (One step per line — SRS §8.4)</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder={'Design API schema\nImplement serializer validation\nWrite unit tests'}
                value={checklistInput}
                onChange={(e) => setChecklistInput(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? 'Saving Task...'
              : isEdit
                ? 'Save Task Changes'
                : parentTask
                  ? 'Create Subtask'
                  : 'Create Task'}
          </button>
          <Link to="/tasks" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
