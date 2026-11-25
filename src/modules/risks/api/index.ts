import { apiRequest } from '@/api/client'

export interface RiskItem {
  id: string
  project: string
  project_name: string
  title: string
  description: string | null
  probability: string
  impact: string
  severity: string
  owner: string | null
  owner_name: string | null
  mitigation_plan: string | null
  due_date: string | null
  status: string
}

export interface IssueItem {
  id: string
  project: string
  project_name: string
  task: string | null
  task_title: string | null
  title: string
  description: string | null
  priority: string
  owner: string | null
  owner_name: string | null
  reported_by_name: string
  reported_at: string
  due_date: string | null
  resolution_notes: string | null
  status: string
}

export interface BlockerItem {
  id: string
  task: string
  task_title: string
  description: string
  category: string | null
  impact: string
  responsible_person: string | null
  responsible_person_name: string | null
  reported_by_name: string
  reported_at: string
  resolution_status: string
  resolved_at: string | null
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : (data.results ?? [])
}

export const risksApi = {
  listRisks: async (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return unwrap(await apiRequest<RiskItem[] | { results?: RiskItem[] }>(`api/risks/risks/${qs}`))
  },
  createRisk: (payload: Partial<RiskItem>) =>
    apiRequest<RiskItem>('api/risks/risks/', { method: 'POST', body: payload }),
  updateRisk: (id: string, payload: Partial<RiskItem>) =>
    apiRequest<RiskItem>(`api/risks/risks/${id}/`, { method: 'PATCH', body: payload }),

  listIssues: async (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return unwrap(await apiRequest<IssueItem[] | { results?: IssueItem[] }>(`api/risks/issues/${qs}`))
  },
  createIssue: (payload: Partial<IssueItem>) =>
    apiRequest<IssueItem>('api/risks/issues/', { method: 'POST', body: payload }),
  updateIssue: (id: string, payload: Partial<IssueItem>) =>
    apiRequest<IssueItem>(`api/risks/issues/${id}/`, { method: 'PATCH', body: payload }),

  listBlockers: async (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return unwrap(await apiRequest<BlockerItem[] | { results?: BlockerItem[] }>(`api/risks/blockers/${qs}`))
  },
  updateBlocker: (id: string, payload: Partial<BlockerItem>) =>
    apiRequest<BlockerItem>(`api/risks/blockers/${id}/`, { method: 'PATCH', body: payload }),
}
