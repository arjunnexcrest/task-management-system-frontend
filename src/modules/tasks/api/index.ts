import { env } from '@/config/env'

const BASE_URL = `${env.apiBaseUrl}/api`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || `HTTP error ${res.status}`)
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
  depends_on_task: string
  depends_on_title: string
  depends_on_status: string
  dependency_type: 'Finish-to-Start' | 'Start-to-Start' | 'Finish-to-Finish' | 'Start-to-Finish'
  created_at: string
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

export interface TaskComment {
  id: string
  task: string
  author: string
  author_name: string
  parent_comment: string | null
  content: string
  created_at: string
  updated_at: string | null
}

export interface Task {
  id: string
  project: string
  project_name: string
  project_code: string
  parent_task: string | null
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
  progress: string | number
  progress_method: 'Manual' | 'Subtasks' | 'Checklist'
  approval_required: boolean
  is_overdue: boolean
  subtasks_count: number
  active_assignments: ActiveAssignmentSummary[]
  tags: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaskDetail extends Task {
  subtasks: SubtaskSummary[]
  assignments: TaskAssignment[]
  dependencies: TaskDependency[]
  checklists: Checklist[]
  comments: TaskComment[]
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

  assignTask: (
    taskId: string,
    payload: {
      assignment_type: 'User' | 'Team'
      user?: string | null
      team?: string | null
      assigned_by?: string
      replace_existing?: boolean
    },
  ) =>
    request<TaskAssignment>(`/tasks/${taskId}/assign/`, {
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

  createChecklist: (payload: { task: string; title: string; sort_order?: number }) =>
    request<Checklist>('/tasks/checklists/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createChecklistItem: (payload: { checklist: string; title: string; sort_order?: number }) =>
    request<ChecklistItem>('/tasks/checklist-items/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleChecklistItem: (itemId: string) =>
    request<ChecklistItem>(`/tasks/checklist-items/${itemId}/toggle/`, {
      method: 'POST',
    }),

  addComment: (payload: { task: string; content: string; author?: string }) =>
    request<TaskComment>('/tasks/comments/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getKanban: (projectId?: string) => {
    const query = projectId ? `?project=${projectId}` : ''
    return request<Record<string, Task[]>>(`/tasks/kanban/${query}`)
  },
}
