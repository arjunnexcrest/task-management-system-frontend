import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type LookupData, type Project, projectsApi } from '@/modules/projects/api'

interface DraftPhase {
  name: string
  start_date: string
  end_date: string
  status: string
}

interface DraftMilestone {
  title: string
  target_date: string
  completion_criteria: string
  approval_required: boolean
}

export function Page() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [lookup, setLookup] = useState<LookupData | null>(null)
  const [company, setCompany] = useState('')
  const [projectManager, setProjectManager] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Project['priority']>('High')
  const [status, setStatus] = useState<Project['status']>('Active')
  const [startDate, setStartDate] = useState('')
  const [plannedCompletionDate, setPlannedCompletionDate] = useState('')
  const [budget, setBudget] = useState('')
  const [progress, setProgress] = useState('0')
  const [objectives, setObjectives] = useState('')
  const [deliverables, setDeliverables] = useState('')

  // SRS §6.1 Participating Departments, Teams, and Members
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  // SRS §6.1 & §6.4 Initial Phases & Milestones during creation
  const [initialPhases, setInitialPhases] = useState<DraftPhase[]>([])
  const [initialMilestones, setInitialMilestones] = useState<DraftMilestone[]>([])

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    projectsApi.getLookup().then((data) => {
      setLookup(data)
      if (!isEdit && data.companies.length > 0) {
        setCompany(data.companies[0].id)
      }
      if (!isEdit && data.users.length > 0) {
        setProjectManager(data.users[0].id)
        setSelectedMembers([data.users[0].id])
      }
    })
    if (id) {
      projectsApi.getProject(id).then((proj) => {
        setCompany(proj.company)
        setProjectManager(proj.project_manager || '')
        setName(proj.name)
        setCode(proj.code)
        setDescription(proj.description || '')
        setPriority(proj.priority)
        setStatus(proj.status)
        setStartDate(proj.start_date || '')
        setPlannedCompletionDate(proj.planned_completion_date || '')
        setBudget(proj.budget !== null && proj.budget !== undefined ? String(proj.budget) : '')
        setProgress(proj.progress !== null && proj.progress !== undefined ? String(proj.progress) : '0')
        setObjectives(proj.objectives || '')
        setDeliverables(proj.deliverables || '')
        setSelectedDepartments(
          proj.department_ids || proj.project_departments.map((pd) => pd.department),
        )
        setSelectedTeams(proj.team_ids || proj.project_teams.map((pt) => pt.team))
        setSelectedMembers(
          proj.member_ids ||
            proj.members.filter((m) => m.status === 'Active').map((m) => m.user),
        )
      })
    }
  }, [id, isEdit])

  const companyDepartments =
    lookup?.departments.filter((d) => !company || d.company_id === company) || []

  const companyDepartmentIds = new Set(companyDepartments.map((d) => d.id))

  const companyTeams =
    lookup?.teams.filter((t) => !company || companyDepartmentIds.has(t.department_id)) || []

  function toggleItem(list: string[], setter: (next: string[]) => void, item: string) {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item))
    } else {
      setter([...list, item])
    }
  }

  function addDraftPhase() {
    setInitialPhases([
      ...initialPhases,
      { name: '', start_date: startDate || '', end_date: plannedCompletionDate || '', status: 'Not Started' },
    ])
  }

  function addDraftMilestone() {
    setInitialMilestones([
      ...initialMilestones,
      { title: '', target_date: plannedCompletionDate || '', completion_criteria: '', approval_required: true },
    ])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    if (status === 'Active' && !projectManager) {
      setError('Active projects require an accountable Project Manager (SRS §1.4 & DB Design §4.3).')
      setSubmitting(false)
      return
    }
    if (startDate && plannedCompletionDate && plannedCompletionDate < startDate) {
      setError('Planned completion date cannot be earlier than start date.')
      setSubmitting(false)
      return
    }

    try {
      const payload: Partial<Project> = {
        company,
        project_manager: projectManager || null,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        priority,
        status,
        start_date: startDate || null,
        planned_completion_date: plannedCompletionDate || null,
        budget: budget ? Number(budget) : null,
        progress: progress ? Number(progress) : 0,
        objectives: objectives.trim() || null,
        deliverables: deliverables.trim() || null,
        department_ids: selectedDepartments,
        team_ids: selectedTeams,
        member_ids: selectedMembers,
      }

      if (!isEdit) {
        const validPhases = initialPhases.filter((p) => p.name.trim())
        const validMilestones = initialMilestones.filter((m) => m.title.trim() && m.target_date)
        if (validPhases.length > 0) payload.initial_phases = validPhases
        if (validMilestones.length > 0) payload.initial_milestones = validMilestones
      }

      if (isEdit && id) {
        await projectsApi.updateProject(id, payload)
        navigate(`/projects/${id}`)
      } else {
        const created = await projectsApi.createProject(payload)
        navigate(`/projects/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">SRS Module 4 (§6.1) · Project Setup & Assignment</p>
          <h1>{isEdit ? `Edit Project: ${code}` : 'Create New Project'}</h1>
          <p>
            Configure company ownership, accountable project manager, participating departments, teams,
            members, schedule, budget, and milestones.
          </p>
        </div>
        <div className="btn-row">
          {isEdit && id && (
            <Link to={`/projects/${id}`} className="btn">
              Cancel & View Overview
            </Link>
          )}
          <Link to="/projects" className="btn">
            Back to Projects
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
              padding: '0.85rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <h3 style={{ marginBottom: '0.75rem' }}>1. Core Project Identity & Ownership</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Company * (SRS §6.1)</label>
            <select
              className="select"
              required
              value={company}
              onChange={(e) => {
                setCompany(e.target.value)
                setSelectedDepartments([])
                setSelectedTeams([])
              }}
            >
              <option value="">Select company...</option>
              {lookup?.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Project Code * (Unique per Company)</label>
            <input
              className="input"
              required
              placeholder="e.g. PRJ-2026-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Project Name *</label>
            <input
              className="input"
              required
              placeholder="Enter project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>
              Accountable Project Manager {status === 'Active' ? '*' : '(Required for Active)'}
            </label>
            <select
              className="select"
              required={status === 'Active'}
              value={projectManager}
              onChange={(e) => {
                const pmId = e.target.value
                setProjectManager(pmId)
                if (pmId && !selectedMembers.includes(pmId)) {
                  setSelectedMembers([...selectedMembers, pmId])
                }
              }}
            >
              <option value="">Unassigned</option>
              {lookup?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.designation || u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Priority (SRS §6.1)</label>
            <select
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Project['priority'])}
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="form-field">
            <label>Project Status (SRS §6.2)</label>
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Project['status'])}
            >
              <option value="Draft">Draft</option>
              <option value="Planned">Planned</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="At Risk">At Risk</option>
              <option value="Delayed">Delayed</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Archived">Archived</option>
            </select>
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
            <label>Planned Completion Date</label>
            <input
              type="date"
              className="input"
              value={plannedCompletionDate}
              onChange={(e) => setPlannedCompletionDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Budget (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="150000.00"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Overall Completion Progress (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            />
          </div>
        </div>

        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
          2. Scope, Objectives & Deliverables
        </h3>
        <div className="form-field">
          <label>Project Description</label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Detailed scope and summary of the project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-grid" style={{ marginTop: '1rem' }}>
          <div className="form-field">
            <label>Project Objectives (SRS §6.1)</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Key business and technical objectives..."
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Project Deliverables (SRS §6.1)</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Expected outputs, artifacts, and sign-off deliverables..."
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
            />
          </div>
        </div>

        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
          3. Participating Departments, Teams & Project Members (SRS §6.1 & §6.3)
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Participating Departments ({selectedDepartments.length} selected)</label>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                maxHeight: '180px',
                overflowY: 'auto',
                background: '#f8fafc',
              }}
            >
              {companyDepartments.map((dept) => (
                <label
                  key={dept.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.3rem 0',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(dept.id)}
                    onChange={() =>
                      toggleItem(selectedDepartments, setSelectedDepartments, dept.id)
                    }
                  />
                  <span>
                    <strong>{dept.name}</strong> ({dept.code})
                  </span>
                </label>
              ))}
              {companyDepartments.length === 0 && (
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  No departments found for this company.
                </span>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Participating Teams ({selectedTeams.length} selected)</label>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                maxHeight: '180px',
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
                    padding: '0.3rem 0',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(tm.id)}
                    onChange={() => toggleItem(selectedTeams, setSelectedTeams, tm.id)}
                  />
                  <span>
                    <strong>{tm.name}</strong> ({tm.code})
                  </span>
                </label>
              ))}
              {companyTeams.length === 0 && (
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  No teams found for this company.
                </span>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Project Team Members ({selectedMembers.length} selected)</label>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                maxHeight: '180px',
                overflowY: 'auto',
                background: '#f8fafc',
              }}
            >
              {lookup?.users.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.3rem 0',
                    cursor: 'pointer',
                    fontWeight: 400,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleItem(selectedMembers, setSelectedMembers, u.id)}
                  />
                  <span>
                    <strong>{u.full_name}</strong> — {u.designation || u.email}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {!isEdit && (
          <>
            <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
              4. Initial Phases & Milestones (SRS §6.1 & §6.4)
            </h3>
            <div className="form-grid">
              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <strong>Initial Project Phases ({initialPhases.length})</strong>
                  <button type="button" className="btn btn-sm" onClick={addDraftPhase}>
                    + Add Phase
                  </button>
                </div>
                {initialPhases.map((ph, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr auto',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <input
                      className="input"
                      placeholder="Phase name (e.g. Phase 1: Design)"
                      value={ph.name}
                      onChange={(e) => {
                        const copy = [...initialPhases]
                        copy[idx].name = e.target.value
                        setInitialPhases(copy)
                      }}
                    />
                    <input
                      type="date"
                      className="input"
                      value={ph.start_date}
                      onChange={(e) => {
                        const copy = [...initialPhases]
                        copy[idx].start_date = e.target.value
                        setInitialPhases(copy)
                      }}
                    />
                    <input
                      type="date"
                      className="input"
                      value={ph.end_date}
                      onChange={(e) => {
                        const copy = [...initialPhases]
                        copy[idx].end_date = e.target.value
                        setInitialPhases(copy)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setInitialPhases(initialPhases.filter((_, i) => i !== idx))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {initialPhases.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
                    Optional: Add initial project phases now or configure them later in Project Planning.
                  </p>
                )}
              </div>

              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <strong>Initial Project Milestones ({initialMilestones.length})</strong>
                  <button type="button" className="btn btn-sm" onClick={addDraftMilestone}>
                    + Add Milestone
                  </button>
                </div>
                {initialMilestones.map((ms, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1.5fr auto',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <input
                      className="input"
                      placeholder="Milestone title"
                      value={ms.title}
                      onChange={(e) => {
                        const copy = [...initialMilestones]
                        copy[idx].title = e.target.value
                        setInitialMilestones(copy)
                      }}
                    />
                    <input
                      type="date"
                      className="input"
                      required
                      value={ms.target_date}
                      onChange={(e) => {
                        const copy = [...initialMilestones]
                        copy[idx].target_date = e.target.value
                        setInitialMilestones(copy)
                      }}
                    />
                    <input
                      className="input"
                      placeholder="Completion criteria"
                      value={ms.completion_criteria}
                      onChange={(e) => {
                        const copy = [...initialMilestones]
                        copy[idx].completion_criteria = e.target.value
                        setInitialMilestones(copy)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setInitialMilestones(initialMilestones.filter((_, i) => i !== idx))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {initialMilestones.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
                    Optional: Add initial milestones now or manage them later in Project Milestones.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="btn-row" style={{ marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving Project...' : isEdit ? 'Update Project' : 'Create Project'}
          </button>
          <Link to={isEdit && id ? `/projects/${id}` : '/projects'} className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
