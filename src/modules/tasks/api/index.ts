import { env } from '@/config/env'
import { tokenStorage } from '@/api/client'
import type { ApprovalChainInfo, ReviewSlaInfo, TaskReviewItem } from '@/modules/reviews/api'
import type { CreateProgressUpdatePayload, ProgressUpdateItem } from '@/modules/tracking/api'

const BASE_URL = `${env.apiBaseUrl}/api`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenStorage.getAccess()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  })
  if (!res.ok) {
    const errText = await res.text()
    if (errText && !errText.trim().startsWith('<')) {
      try {
        const parsed = JSON.parse(errText)
        if (parsed.error) {
          throw new Error(typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error))
        }
        if (parsed.detail) {
          throw new Error(typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail))
        }
      } catch (inner) {
        if (
          inner instanceof Error &&
          inner.message &&
          !inner.message.startsWith('Unexpected token') &&
          !inner.message.startsWith('JSON')
        ) {
          throw inner
        }
      }
      throw new Error(errText || `HTTP error ${res.status}`)
    }
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || []
}

export interface ActiveAssignmentSummary {
  id: string
  assignment_type: 'User' | 'Team'
  user_id: string | null
  user_name: string | null
  team_id: string | null
  team_name: string | null
  status: string
  assigned_at: string
}

export interface TaskAssignment {
  id: string
  task: string
  user: string | null
  user_name: string | null
  user_email: string | null
  team: string | null
  team_name: string | null
  assignment_type: 'User' | 'Team'
  assigned_by: string
  assigned_by_name: string | null
  assigned_at: string
  ended_at: string | null
  status: 'Active' | 'Acknowledged' | 'Reassigned' | 'Ended'
}

export interface SubtaskSummary {
  id: string
  project: string
  parent_task: string | null
  title: string
  priority: string
  status: string
  start_date: string | null
  due_date: string | null
  estimated_effort: string | number | null
  progress: string | number
  task_owner: string | null
  task_owner_name: string | null
  created_at: string
  completed_at: string | null
}

export interface TaskDependency {
  id: string
  task: string
  task_title?: string
  task_status?: string
  task_start_date?: string | null
  task_due_date?: string | null
  depends_on_task: string
  depends_on_title: string
  depends_on_status: string
  depends_on_priority?: string
  depends_on_start_date?: string | null
  depends_on_due_date?: string | null
  depends_on_owner_name?: string | null
  depends_on_is_overdue?: boolean
  dependency_type: 'Finish-to-Start' | 'Start-to-Start' | 'Finish-to-Finish' | 'Start-to-Finish'
  is_satisfied_for_start?: boolean
  is_satisfied_for_complete?: boolean
  schedule_conflict?: string | null
  created_at: string
}

export interface WorkingCalendarConfig {
  company_id: string | null
  company_name: string | null
  company_code: string | null
  working_days: number[]
  working_day_labels: string[]
  holidays: string[]
  hours_per_day: number
  due_soon_days: number
  deadline_reminder_days: number
}

export interface DependencyBlockingEntry {
  dependency_id: string
  depends_on_task_id: string
  depends_on_title: string
  depends_on_status: string
  depends_on_priority: string
  depends_on_due_date: string | null
  dependency_type: TaskDependency['dependency_type']
  is_overdue: boolean
  is_blocked: boolean
  reason: string | null
}

export interface DependencyScheduleConflict {
  dependency_id: string
  depends_on_task_id: string
  depends_on_title: string
  dependency_type: TaskDependency['dependency_type']
  slip_days: number
  message: string
}

export interface DependencyDownstreamItem {
  dependency_id: string
  task_id: string
  title: string
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  task_owner_id: string | null
  task_owner_name: string | null
  dependency_type: TaskDependency['dependency_type']
  via_task_id: string
  via_task_title: string
  hop_distance: number
  is_overdue: boolean
  due_status: string
  schedule_conflict: string | null
  slip_days: number
}

export interface DependencyDelayWarning {
  severity: 'Critical' | 'High' | 'Warning'
  reason: string
  source_task_id: string
  source_task_title: string
  affected_task_id: string
  affected_task_title: string
  affected_task_status: string
  affected_task_due_date: string | null
  affected_task_owner_name?: string | null
  dependency_type: TaskDependency['dependency_type']
  hop_distance?: number
  slip_days: number
  message: string
}

export interface TaskDependencyImpactResponse {
  task_id: string
  task_title: string
  task_status: string
  schedule_metrics: {
    is_overdue: boolean
    days_remaining: number | null
    days_overdue: number
    working_days_remaining: number | null
    working_days_overdue: number
    planned_working_days: number | null
    due_status: string
    overdue_severity: 'None' | 'Warning' | 'High' | 'Critical'
  }
  is_dependency_blocked: boolean
  blocking_prerequisites: DependencyBlockingEntry[]
  blocking_prerequisites_count: number
  unsatisfied_for_start: DependencyBlockingEntry[]
  unsatisfied_for_complete: DependencyBlockingEntry[]
  schedule_conflicts: DependencyScheduleConflict[]
  at_risk_prerequisites: DependencyBlockingEntry[]
  direct_dependents: DependencyDownstreamItem[]
  transitive_dependents: DependencyDownstreamItem[]
  downstream_direct_count: number
  downstream_total_count: number
  open_downstream_count: number
  delay_warnings: DependencyDelayWarning[]
  is_critical_bottleneck: boolean
}

export interface ProjectDependencyGraphNode {
  id: string
  title: string
  is_subtask: boolean
  parent_task: string | null
  phase: string | null
  phase_name: string | null
  status: Task['status']
  priority: Task['priority']
  progress: number
  start_date: string | null
  due_date: string | null
  task_owner_id: string | null
  task_owner_name: string | null
  topological_level: number
  upstream_count: number
  downstream_count: number
  is_dependency_blocked: boolean
  blocking_prerequisites_count: number
  has_schedule_conflicts: boolean
  is_overdue: boolean
  days_remaining: number | null
  days_overdue: number
  working_days_remaining: number | null
  working_days_overdue: number
  planned_working_days: number | null
  due_status: string
  overdue_severity: 'None' | 'Warning' | 'High' | 'Critical'
}

export interface ProjectDependencyGraphEdge {
  id: string
  task: string
  task_title: string
  task_status: string
  depends_on_task: string
  depends_on_title: string
  depends_on_status: string
  dependency_type: TaskDependency['dependency_type']
  is_satisfied_for_start: boolean
  is_satisfied_for_complete: boolean
  has_schedule_conflict: boolean
  schedule_conflict: string | null
  slip_days: number
}

export interface ProjectDependencyGraphResponse {
  project_id: string
  as_of_date: string
  working_calendar: WorkingCalendarConfig
  summary: {
    total_tasks: number
    total_dependencies: number
    blocked_tasks_count: number
    overdue_tasks_count: number
    schedule_conflicts_count: number
    at_risk_dependents_count: number
    warnings_count: number
  }
  nodes: ProjectDependencyGraphNode[]
  edges: ProjectDependencyGraphEdge[]
  warnings: DependencyDelayWarning[]
}

export interface OverdueSummaryTaskItem {
  id: string
  title: string
  project: string
  project_code: string
  project_name: string
  company_code: string
  status: Task['status']
  priority: Task['priority']
  progress: number
  start_date: string | null
  due_date: string | null
  task_owner_name: string | null
  is_dependency_blocked: boolean
  blocking_prerequisites_count: number
  downstream_dependents_count: number
  is_overdue: boolean
  days_remaining: number | null
  days_overdue: number
  working_days_remaining: number | null
  working_days_overdue: number
  planned_working_days: number | null
  due_status: string
  overdue_severity: 'None' | 'Warning' | 'High' | 'Critical'
}

export interface OverdueSummaryResponse {
  as_of_date: string
  working_calendar: WorkingCalendarConfig
  kpis: {
    total_evaluated: number
    overdue_count: number
    critical_overdue_count: number
    high_overdue_count: number
    warning_overdue_count: number
    due_today_count: number
    due_soon_count: number
    dependency_blocked_count: number
    at_risk_dependent_count: number
  }
  overdue_tasks: OverdueSummaryTaskItem[]
  due_today_tasks: OverdueSummaryTaskItem[]
  due_soon_tasks: OverdueSummaryTaskItem[]
  dependency_blocked_tasks: OverdueSummaryTaskItem[]
}

export interface CheckDeadlinesResponse {
  as_of_date: string
  scanned_tasks: number
  overdue_tasks_found: number
  upcoming_deadlines_found: number
  dependency_warnings_sent: number
  notifications_created: number
  skipped_duplicates: number
  alerts: Array<{
    task_id: string
    title: string
    project_code: string
    alert_type: 'TASK_OVERDUE' | 'UPCOMING_DEADLINE'
    severity: string
    days_overdue?: number
    working_days_overdue?: number
    days_remaining?: number
    working_days_remaining?: number
    notifications_sent: number
  }>
}

export interface ChecklistItem {
  id: string
  checklist: string
  title: string
  is_completed: boolean
  notes: string | null
  link: string | null
  sort_order: number
  completed_by: string | null
  completed_by_name: string | null
  completed_at: string | null
}

export interface Checklist {
  id: string
  task: string
  title: string
  sort_order: number
  created_by: string
  created_at: string
  items: ChecklistItem[]
  completion_percentage: number
}

export interface AttachmentDetail {
  id: string
  uploaded_by: string
  uploaded_by_name: string
  file_name: string
  download_url: string
  preview_url: string
  file_category: 'image' | 'video' | 'document' | 'archive'
  mime_type: string
  file_size_bytes: number
  checksum: string | null
  uploaded_at: string
}

export interface TaskAttachmentItem {
  id: string
  task: string
  attachment: string
  attachment_detail: AttachmentDetail
}

export interface CommentAttachmentItem {
  id: string
  comment: string
  attachment: string
  attachment_detail: AttachmentDetail
}

export interface TaskComment {
  id: string
  task: string
  author: string
  author_name: string
  parent_comment: string | null
  content: string
  mentions?: Array<{
    id: string
    comment: string
    mentioned_user: string
    mentioned_user_name: string
  }>
  attachments?: CommentAttachmentItem[]
  replies_count?: number
  created_at: string
  updated_at: string | null
}

export interface Task {
  id: string
  company_id?: string
  company_name?: string
  company_code?: string
  project: string
  project_name: string
  project_code: string
  parent_task: string | null
  parent_task_title?: string | null
  is_subtask: boolean
  phase: string | null
  phase_name: string | null
  department: string | null
  department_name: string | null
  team: string | null
  team_name: string | null
  title: string
  description: string | null
  task_owner: string | null
  task_owner_name: string | null
  created_by: string
  created_by_name: string | null
  reviewer: string | null
  reviewer_name: string | null
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  status:
    | 'Backlog'
    | 'To Do'
    | 'Assigned'
    | 'In Progress'
    | 'On Hold'
    | 'Blocked'
    | 'In Review'
    | 'Changes Requested'
    | 'Approved'
    | 'Completed'
    | 'Cancelled'
  start_date: string | null
  due_date: string | null
  estimated_effort: string | number | null
  actual_effort_hours?: number
  progress: string | number
  progress_method: 'Manual' | 'Subtasks' | 'Checklist'
  approval_required: boolean
  is_overdue: boolean
  days_remaining?: number | null
  days_overdue?: number
  working_days_remaining?: number | null
  working_days_overdue?: number
  planned_working_days?: number | null
  due_status?: 'Overdue' | 'Due Today' | 'Due Soon' | 'On Track' | 'Completed' | 'No Due Date'
  overdue_severity?: 'None' | 'Warning' | 'High' | 'Critical'
  is_dependency_blocked?: boolean
  blocking_prerequisites_count?: number
  downstream_dependents_count?: number
  dependency_warnings_count?: number
  allowed_transitions?: Task['status'][]
  subtasks_count: number
  active_assignments: ActiveAssignmentSummary[]
  tags: string[]
  assignee_user_ids?: string[]
  assignee_team_ids?: string[]
  tag_names?: string[]
  dependency_task_ids?: string[]
  initial_checklist_items?: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaskDetail extends Task {
  subtasks: SubtaskSummary[]
  assignments: TaskAssignment[]
  dependencies: TaskDependency[]
  dependent_tasks?: TaskDependency[]
  dependency_summary?: TaskDependencyImpactResponse
  working_calendar?: WorkingCalendarConfig
  checklists: Checklist[]
  comments: TaskComment[]
  progress_updates?: ProgressUpdateItem[]
  reviews?: TaskReviewItem[]
  approval_chain?: ApprovalChainInfo
  review_sla?: ReviewSlaInfo
  task_attachments?: TaskAttachmentItem[]
}

export const tasksApi = {
  listTasks: async (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    const data = await request<Task[] | { results: Task[] }>(`/tasks/${query}`)
    return unwrapList(data)
  },

  getTask: (id: string) => request<TaskDetail>(`/tasks/${id}/`),

  createTask: (payload: Partial<Task>) =>
    request<Task>('/tasks/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (id: string, payload: Partial<Task>) =>
    request<Task>(`/tasks/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTask: (id: string) =>
    request<void>(`/tasks/${id}/`, {
      method: 'DELETE',
    }),

  transitionStatus: (
    taskId: string,
    status: Task['status'],
    options?: {
      reason?: string
      override_subtasks?: boolean
      override_dependencies?: boolean
      override_reason?: string
    },
  ) =>
    request<TaskDetail>(`/tasks/${taskId}/transition-status/`, {
      method: 'POST',
      body: JSON.stringify({ status, ...(options || {}) }),
    }),

  getDependencyImpact: (taskId: string) =>
    request<TaskDependencyImpactResponse>(`/tasks/${taskId}/dependency-impact/`),

  getDependencyGraph: (projectId: string) =>
    request<ProjectDependencyGraphResponse>(`/tasks/dependency-graph/?project=${projectId}`),

  getOverdueSummary: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    return request<OverdueSummaryResponse>(`/tasks/overdue-summary/${query}`)
  },

  checkDeadlines: (payload?: { company?: string; project?: string; dedupe_hours?: number }) =>
    request<CheckDeadlinesResponse>('/tasks/check-deadlines/', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  getWorkingCalendar: (companyId?: string) => {
    const query = companyId ? `?company=${companyId}` : ''
    return request<WorkingCalendarConfig>(`/tasks/working-calendar/${query}`)
  },

  updateWorkingCalendar: (payload: {
    company?: string
    working_days?: number[]
    holidays?: string[]
    hours_per_day?: number
    due_soon_days?: number
    deadline_reminder_days?: number
  }) =>
    request<WorkingCalendarConfig>('/tasks/working-calendar/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAllowedTransitions: (taskId: string) =>
    request<{
      task_id: string
      current_status: Task['status']
      allowed_transitions: Task['status'][]
    }>(`/tasks/${taskId}/allowed-transitions/`),

  assignTask: (
    taskId: string,
    payload: {
      assignment_type: 'User' | 'Team'
      user?: string | null
      team?: string | null
      assigned_by?: string
      replace_existing?: boolean
      task_owner?: string | null
      reviewer?: string | null
      entire_team_responsible?: boolean
    },
  ) =>
    request<TaskAssignment>(`/tasks/${taskId}/assign/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bulkAssignTasks: (payload: {
    task_ids: string[]
    user?: string | null
    assignee_user_ids?: string[]
    team?: string | null
    assignee_team_ids?: string[]
    task_owner?: string | null
    reviewer?: string | null
    priority?: Task['priority'] | ''
    due_date?: string | null
    start_date?: string | null
    replace_existing?: boolean
  }) =>
    request<{ updated_count: number; tasks: Task[] }>('/tasks/bulk_assign/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  rescheduleTask: (
    taskId: string,
    payload: {
      start_date?: string | null
      due_date?: string | null
      estimated_effort?: number | string | null
      priority?: Task['priority']
      reason?: string
    },
  ) =>
    request<TaskDetail>(`/tasks/${taskId}/reschedule/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  acknowledgeAssignment: (assignmentId: string) =>
    request<TaskAssignment>(`/tasks/assignments/${assignmentId}/acknowledge/`, {
      method: 'POST',
    }),

  endAssignment: (assignmentId: string, status: 'Reassigned' | 'Ended' = 'Ended') =>
    request<TaskAssignment>(`/tasks/assignments/${assignmentId}/end/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  addDependency: (payload: {
    task: string
    depends_on_task: string
    dependency_type?: TaskDependency['dependency_type']
  }) =>
    request<TaskDependency>('/tasks/dependencies/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteDependency: (dependencyId: string) =>
    request<void>(`/tasks/dependencies/${dependencyId}/`, {
      method: 'DELETE',
    }),

  createChecklist: (payload: { task: string; title: string; sort_order?: number }) =>
    request<Checklist>('/tasks/checklists/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteChecklist: (checklistId: string) =>
    request<void>(`/tasks/checklists/${checklistId}/`, {
      method: 'DELETE',
    }),

  reorderChecklistItems: (checklistId: string, itemIds: string[]) =>
    request<Checklist>(`/tasks/checklists/${checklistId}/reorder_items/`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    }),

  createChecklistItem: (payload: {
    checklist: string
    title: string
    notes?: string | null
    link?: string | null
    sort_order?: number
  }) =>
    request<ChecklistItem>('/tasks/checklist-items/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateChecklistItem: (
    itemId: string,
    payload: {
      title?: string
      notes?: string | null
      link?: string | null
      is_completed?: boolean
      sort_order?: number
    },
  ) =>
    request<ChecklistItem>(`/tasks/checklist-items/${itemId}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteChecklistItem: (itemId: string) =>
    request<void>(`/tasks/checklist-items/${itemId}/`, {
      method: 'DELETE',
    }),

  toggleChecklistItem: (itemId: string) =>
    request<ChecklistItem>(`/tasks/checklist-items/${itemId}/toggle/`, {
      method: 'POST',
    }),

  addComment: (payload: {
    task: string
    content: string
    parent_comment?: string | null
    mentioned_user_ids?: string[]
    attachment_ids?: string[]
    author?: string
  }) =>
    request<TaskComment>('/tasks/comments/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateComment: (commentId: string, payload: { content: string; mentioned_user_ids?: string[] }) =>
    request<TaskComment>(`/tasks/comments/${commentId}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteComment: (commentId: string) =>
    request<void>(`/tasks/comments/${commentId}/`, {
      method: 'DELETE',
    }),

  listProgressUpdates: async (taskId: string) => {
    const data = await request<ProgressUpdateItem[] | { results: ProgressUpdateItem[] }>(
      `/tasks/${taskId}/progress-updates/`,
    )
    return unwrapList(data)
  },

  addProgressUpdate: (taskId: string, payload: Omit<CreateProgressUpdatePayload, 'task'>) =>
    request<ProgressUpdateItem>(`/tasks/${taskId}/progress-updates/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadFiles: async (
    files: File[],
    options?: {
      task?: string
      comment?: string
      progress_update?: string
      uploaded_by?: string
    },
  ) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    if (options?.task) formData.append('task', options.task)
    if (options?.comment) formData.append('comment', options.comment)
    if (options?.progress_update) formData.append('progress_update', options.progress_update)
    if (options?.uploaded_by) formData.append('uploaded_by', options.uploaded_by)

    const token = tokenStorage.getAccess()
    const res = await fetch(`${BASE_URL}/tasks/attachments/upload/`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(errText || `HTTP error ${res.status}`)
    }
    return res.json() as Promise<{ uploaded_count: number; attachments: AttachmentDetail[] }>
  },

  deleteAttachment: (attachmentId: string) =>
    request<void>(`/tasks/attachments/${attachmentId}/`, {
      method: 'DELETE',
    }),

  deleteTaskAttachment: (taskAttachmentId: string) =>
    request<void>(`/tasks/task-attachments/${taskAttachmentId}/`, {
      method: 'DELETE',
    }),

  getAttachmentUrl: (attachmentId: string, inline = false) =>
    `${BASE_URL}/tasks/attachments/${attachmentId}/download/${inline ? '?inline=1' : ''}`,

  getKanban: (params?: string | Record<string, string>) => {
    if (!params) return request<Record<string, Task[]>>('/tasks/kanban/')
    if (typeof params === 'string') {
      return request<Record<string, Task[]>>(`/tasks/kanban/?project=${params}`)
    }
    const cleaned = Object.entries(params).filter(([, v]) => Boolean(v))
    const query = cleaned.length > 0 ? `?${new URLSearchParams(cleaned).toString()}` : ''
    return request<Record<string, Task[]>>(`/tasks/kanban/${query}`)
  },
}
