import { env } from '@/config/env'
import type { AttachmentDetail, Task } from '@/modules/tasks/api'

const BASE_URL = `${env.apiBaseUrl}/api`

function parseErrorText(errText: string, status: number): string {
  if (!errText) return `HTTP error ${status}`
  try {
    const parsed = JSON.parse(errText)
    if (typeof parsed === 'string') return parsed
    if (parsed.error) return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
    if (parsed.detail) return typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail)
    const firstKey = Object.keys(parsed)[0]
    if (firstKey) {
      const val = parsed[firstKey]
      if (Array.isArray(val) && val.length > 0) return `${firstKey}: ${val[0]}`
      if (typeof val === 'string') return `${firstKey}: ${val}`
    }
  } catch {
    // Plain text error
  }
  return errText
}

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
    throw new Error(parseErrorText(errText, res.status))
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || []
}

export type ApprovalLevel =
  | 'Reviewer'
  | 'Team Leader'
  | 'Department Head'
  | 'Project Manager'
  | 'Company In-Charge'

export interface ApprovalChainStep {
  step_number: number
  role: ApprovalLevel | string
  user_id: string | null
  user_name: string
  user_designation: string | null
  status: 'Approved' | 'Pending' | 'Waiting' | 'Awaiting Submission'
  review_id: string | null
  review_round: number | null
  approved_at: string | null
  comments: string | null
}

export interface ApprovalChainInfo {
  chain_source: string
  levels: string[]
  total_steps: number
  completed_steps: number
  current_step_number: number | null
  current_step_role: string | null
  current_reviewer_id: string | null
  current_reviewer_name: string | null
  is_chain_satisfied: boolean
  is_approval_satisfied: boolean
  escalation_hours: number
  allow_reviewer_reassignment: boolean
  steps: ApprovalChainStep[]
}

export interface ReviewSlaInfo {
  submitted_for_review_at: string | null
  hours_awaiting_review: number
  escalation_threshold_hours: number
  is_review_overdue: boolean
}

export interface TaskReviewItem {
  id: string
  task: string
  task_title: string
  task_status: Task['status']
  task_owner_name: string | null
  project_id: string
  project_code: string
  project_name: string
  reviewer: string
  reviewer_name: string
  reviewer_designation: string | null
  decision: 'Approved' | 'Changes Requested' | 'Rejected'
  comments: string | null
  correction_reason: string | null
  reviewed_at: string
  review_round: number
  reference_attachments: AttachmentDetail[]
  approval_chain?: ApprovalChainInfo | null
}

export interface ReviewQueueTask {
  id: string
  company_id: string
  company_code: string
  project: string
  project_code: string
  project_name: string
  project_manager_id: string | null
  project_manager_name: string | null
  department_name: string | null
  team_name: string | null
  is_subtask: boolean
  title: string
  description: string | null
  priority: Task['priority']
  status: Task['status']
  progress: string | number
  due_date: string | null
  approval_required: boolean
  task_owner: string | null
  task_owner_name: string | null
  reviewer: string | null
  reviewer_name: string | null
  approval_chain: ApprovalChainInfo
  sla: ReviewSlaInfo
  reviews_count: number
  correction_rounds_count: number
  attachments_count: number
  latest_review: TaskReviewItem | null
  reviews_history: TaskReviewItem[]
  allowed_transitions: Task['status'][]
  created_at: string
  updated_at: string
}

export interface ApprovalChainRulesConfig {
  chain_source: string
  levels: string[]
  default_chain: string[]
  priority_chains: Record<string, string[]>
  user_overrides: Record<string, string>
  escalation_hours: number
  allow_reviewer_reassignment: boolean
}

export interface ReviewSummaryStats {
  pending_review_count: number
  changes_requested_count: number
  approved_ready_count: number
  ready_to_submit_count: number
  overdue_escalations_count: number
  total_reviews_logged: number
  approved_decisions_count: number
  changes_requested_decisions_count: number
  rejected_decisions_count: number
  first_pass_approval_rate: number
  rules: ApprovalChainRulesConfig
  reviewer_workload: Array<{
    reviewer_id: string
    reviewer_name: string
    pending_count: number
    approved_count: number
    returned_count: number
  }>
  employee_correction_trends: Array<{
    user_id: string
    user_name: string
    total_review_events: number
    approved_events: number
    correction_or_rejection_events: number
  }>
}

export interface EscalationReport {
  checked_count: number
  overdue_count: number
  notifications_sent: number
  escalated_tasks: Array<{
    task_id: string
    task_title: string
    project_code: string
    reviewer_name: string | null
    hours_awaiting_review: number
    escalation_threshold_hours: number
    notified_user_ids: string[]
  }>
}

export const VALID_APPROVAL_LEVELS: ApprovalLevel[] = [
  'Reviewer',
  'Team Leader',
  'Department Head',
  'Project Manager',
  'Company In-Charge',
]

export const reviewsApi = {
  listReviews: async (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    const data = await request<TaskReviewItem[] | { results: TaskReviewItem[] }>(`/reviews/${query}`)
    return unwrapList(data)
  },

  listTaskReviews: async (taskId: string) => {
    const data = await request<TaskReviewItem[] | { results: TaskReviewItem[] }>(
      `/tasks/${taskId}/reviews/`,
    )
    return unwrapList(data)
  },

  getReviewQueue: async (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    const data = await request<ReviewQueueTask[] | { results: ReviewQueueTask[] }>(
      `/reviews/queue/${query}`,
    )
    return unwrapList(data)
  },

  getSummary: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    return request<ReviewSummaryStats>(`/reviews/summary/${query}`)
  },

  getTaskReviewChain: (taskId: string) =>
    request<{
      task_id: string
      valid_levels: ApprovalLevel[]
      approval_chain: ApprovalChainInfo
      sla: ReviewSlaInfo
      reviews: TaskReviewItem[]
    }>(`/tasks/${taskId}/review-chain/`),

  submitForReview: async (payload: {
    task: string
    reviewer?: string | null
    notes?: string
    actor?: string
    approval_required?: boolean
    attachment_ids?: string[]
    files?: File[]
  }) => {
    if (payload.files && payload.files.length > 0) {
      const formData = new FormData()
      formData.append('task', payload.task)
      if (payload.reviewer) formData.append('reviewer', payload.reviewer)
      if (payload.notes) formData.append('notes', payload.notes)
      if (payload.actor) formData.append('actor', payload.actor)
      if (payload.approval_required !== undefined) {
        formData.append('approval_required', String(payload.approval_required))
      }
      payload.files.forEach((f) => formData.append('files', f))
      const res = await fetch(`${BASE_URL}/reviews/submit/`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        throw new Error(parseErrorText(await res.text(), res.status))
      }
      return res.json() as Promise<ReviewQueueTask>
    }

    return request<ReviewQueueTask>('/reviews/submit/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  submitDecision: async (payload: {
    task: string
    decision: 'Approved' | 'Changes Requested' | 'Rejected'
    comments?: string
    correction_reason?: string
    reviewer?: string
    attachment_ids?: string[]
    files?: File[]
  }) => {
    if (payload.files && payload.files.length > 0) {
      const formData = new FormData()
      formData.append('task', payload.task)
      formData.append('decision', payload.decision)
      if (payload.comments) formData.append('comments', payload.comments)
      if (payload.correction_reason) formData.append('correction_reason', payload.correction_reason)
      if (payload.reviewer) formData.append('reviewer', payload.reviewer)
      if (payload.attachment_ids && payload.attachment_ids.length > 0) {
        formData.append('attachment_ids', payload.attachment_ids.join(','))
      }
      payload.files.forEach((f) => formData.append('files', f))

      const res = await fetch(`${BASE_URL}/reviews/submit-decision/`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        throw new Error(parseErrorText(await res.text(), res.status))
      }
      return res.json() as Promise<TaskReviewItem>
    }

    return request<TaskReviewItem>('/reviews/submit-decision/', {
      method: 'POST',
      body: JSON.stringify({
        task: payload.task,
        decision: payload.decision,
        comments: payload.comments,
        correction_reason: payload.correction_reason,
        reviewer: payload.reviewer,
        attachment_ids: payload.attachment_ids,
      }),
    })
  },

  reassignReviewer: (payload: {
    task: string
    new_reviewer: string
    reason?: string
    actor?: string
  }) =>
    request<ReviewQueueTask>('/reviews/reassign-reviewer/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getApprovalChainRules: (params?: { company?: string; project?: string; task?: string }) => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ''
    return request<{
      valid_levels: ApprovalLevel[]
      rules?: ApprovalChainRulesConfig
      approval_chain?: ApprovalChainInfo
    }>(`/reviews/approval-chain/${query}`)
  },

  configureApprovalChain: (payload: {
    scope: 'company' | 'project' | 'task' | 'global'
    levels: string[]
    company?: string
    project?: string
    task?: string
    priority_chains?: Record<string, string[]>
    user_overrides?: Record<string, string>
    escalation_hours?: number
    allow_reviewer_reassignment?: boolean
  }) =>
    request<{
      scope: string
      rules?: ApprovalChainRulesConfig
      approval_chain?: ApprovalChainInfo
    }>('/reviews/approval-chain/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  escalateOverdueReviews: (payload?: {
    company?: string
    project?: string
    threshold_hours?: number
    trigger_notifications?: boolean
    force_notify?: boolean
  }) =>
    request<EscalationReport>('/reviews/escalate-overdue/', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
}
