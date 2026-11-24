import { env } from '@/config/env'
import { tokenStorage } from '@/api/client'

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

export interface ProgressAttachmentItem {
  id: string
  progress_update: string
  attachment: string
  attachment_detail?: {
    id: string
    file_name: string
    mime_type: string
    file_size_bytes: number
    download_url: string
    uploaded_by_name: string
    uploaded_at: string
  }
}

export interface ProgressUpdateItem {
  id: string
  task: string
  task_title: string
  task_status?: string
  task_priority?: string
  task_progress?: string | number
  task_progress_method?: 'Manual' | 'Subtasks' | 'Checklist'
  project_id?: string
  project_name?: string
  project_code?: string
  author: string
  author_name: string
  progress_percentage: string | number
  work_completed: string | null
  remaining_work: string | null
  remarks: string | null
  blockers: string | null
  time_spent_minutes: number | null
  next_action: string | null
  attachments?: ProgressAttachmentItem[]
  created_at: string
}

export interface WorkLogReviewSummary {
  total_updates: number
  tasks_updated_count: number
  blockers_reported_count: number
  planned_vs_completed: {
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    average_reported_progress: number
    average_task_progress: number
  }
  effort_comparison: {
    total_estimated_hours: number
    total_actual_hours: number
    total_logged_minutes: number
    variance_hours: number
  }
  deliverables_comparison: {
    approval_required_tasks: number
    approved_or_completed_tasks: number
    pending_approval_tasks: number
  }
  delayed_tasks_metrics: {
    delayed_tasks_count: number
    time_spent_on_delayed_minutes: number
    time_spent_on_delayed_hours: number
  }
  employee_workload: Array<{
    author_id: string
    author_name: string
    updates_count: number
    tasks_count: number
    total_minutes: number
    total_hours: number
    average_reported_progress: number
    blockers_count: number
  }>
}

export interface TimeEntryItem {
  id: string
  task: string
  task_title: string
  project_code?: string
  user: string
  user_name: string
  started_at: string | null
  ended_at: string | null
  duration_minutes: number
  entry_type: 'Manual' | 'Timer'
  approval_status: 'Pending' | 'Approved' | 'Rejected'
  approved_by: string | null
  approved_by_name: string | null
  created_at: string
}

export interface CreateProgressUpdatePayload {
  task: string
  author?: string
  progress_percentage: number | string
  work_completed?: string | null
  remaining_work?: string | null
  remarks?: string | null
  blockers?: string | null
  time_spent_minutes?: number | null
  next_action?: string | null
  attachment_ids?: string[]
  progress_method?: 'Manual' | 'Subtasks' | 'Checklist'
  mark_task_blocked?: boolean
  blocker_category?: string
  blocker_impact?: 'Low' | 'Medium' | 'High' | 'Critical'
  blocker_responsible_person?: string | null
}

export const trackingApi = {
  listProgressUpdates: async (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    const data = await request<ProgressUpdateItem[] | { results: ProgressUpdateItem[] }>(
      `/tracking/progress-updates/${query}`,
    )
    return unwrapList(data)
  },

  createProgressUpdate: (payload: CreateProgressUpdatePayload) =>
    request<ProgressUpdateItem>('/tracking/progress-updates/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWorkLogSummary: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    return request<WorkLogReviewSummary>(`/tracking/progress-updates/summary/${query}`)
  },

  listTimeEntries: async (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    const data = await request<TimeEntryItem[] | { results: TimeEntryItem[] }>(
      `/tracking/time-entries/${query}`,
    )
    return unwrapList(data)
  },

  createTimeEntry: (payload: Partial<TimeEntryItem>) =>
    request<TimeEntryItem>('/tracking/time-entries/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
