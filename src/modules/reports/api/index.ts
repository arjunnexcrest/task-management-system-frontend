import { apiRequest, tokenStorage } from '@/api/client'
import { env } from '@/config/env'

export interface TaskReportRow {
  id: string
  project_code: string
  title: string
  is_subtask: boolean
  status: string
  priority: string
  progress: string | number
  owner: string | null
  start_date: string | null
  due_date: string | null
  due_status: string
  is_overdue: boolean
  days_overdue: number
  working_days_overdue: number
  overdue_severity: string
  is_dependency_blocked: boolean
  blocking_prerequisites_count: number
}

export interface TaskReportResponse {
  count: number
  results: TaskReportRow[]
}

export const reportsApi = {
  getTaskReport: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : ''
    return apiRequest<TaskReportResponse>(`api/reports/tasks/${qs ? `?${qs}` : ''}`)
  },

  downloadTaskReportCsv: async (params?: Record<string, string>) => {
    const search = new URLSearchParams(params || {})
    search.set('export', 'csv')
    const url = `${env.apiBaseUrl.replace(/\/$/, '')}/api/reports/tasks/?${search.toString()}`
    const token = tokenStorage.getAccess()
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`)
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'tasks_report.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  },
}
