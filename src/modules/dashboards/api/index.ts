import { apiRequest } from '@/api/client'
import type { RoleName, UserCapabilities } from '@/types'

export interface CeoCompanyBreakdown {
  id: string
  name: string
  code: string
  status: string
  is_active: boolean
  members_count: number
  departments_count: number
  teams_count: number
  projects_count: number
  active_projects_count: number
  at_risk_projects_count: number
  tasks_count: number
  completed_tasks_count: number
  overdue_tasks_count: number
  completion_rate: number
  avg_progress: number
  total_budget: number
}

export interface CeoDepartmentBreakdown {
  id: string
  name: string
  code: string | null
  company_id: string
  company_name: string
  status: string
  head_name: string
  teams_count: number
  members_count: number
  tasks_count: number
  completed_tasks_count: number
  overdue_tasks_count: number
  completion_rate: number
}

export interface CeoProjectHealth {
  id: string
  code: string
  name: string
  company_name: string
  project_manager_name: string
  status: string
  priority: string
  progress: number
  budget: number | null
  planned_completion_date: string | null
  tasks_count: number
  completed_tasks_count: number
  overdue_tasks_count: number
}

export interface CeoDashboardResponse {
  selected_company: string | null
  companies_filter: Array<{ id: string; name: string; code: string; status: string }>
  enterprise_kpis: {
    total_companies: number
    active_companies: number
    total_users: number
    active_users: number
    total_departments: number
    total_teams: number
    total_projects: number
    active_projects: number
    completed_projects: number
    at_risk_projects: number
    avg_project_progress: number
    total_budget: number
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    blocked_tasks: number
    dependency_blocked_tasks: number
    pending_reviews: number
    changes_requested: number
    overdue_tasks: number
    critical_overdue_tasks: number
    due_today_tasks: number
    avg_task_progress: number
    open_blockers: number
    open_risks: number
    open_issues: number
  }
  company_breakdown: CeoCompanyBreakdown[]
  department_breakdown: CeoDepartmentBreakdown[]
  project_health: CeoProjectHealth[]
  pending_approvals: Array<{
    id: string
    title: string
    project_id: string
    project_code: string
    company_name: string
    priority: string
    owner_name: string
    reviewer_name: string
    due_date: string | null
  }>
  overdue_highlights: Array<{
    id: string
    title: string
    project_id: string
    project_code: string
    company_name: string
    status: string
    priority: string
    owner_name: string
    due_date: string | null
    days_overdue: number
  }>
  tasks_by_status: Array<{ status: string; count: number }>
  tasks_by_priority: Array<{ priority: string; count: number }>
}

export interface RoleDashboardResponse {
  role: RoleName
  roles: RoleName[]
  capabilities: UserCapabilities
  scope_title: string
  user: {
    id: string
    full_name: string
    email: string
    username: string
    employee_id: string | null
    designation: string | null
  }
  kpis: {
    total_projects: number
    active_projects: number
    at_risk_projects: number
    avg_project_progress: number
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    blocked_tasks: number
    dependency_blocked_tasks: number
    pending_reviews: number
    changes_requested: number
    overdue_tasks: number
    due_today_tasks: number
    due_soon_tasks: number
    avg_task_progress: number
    logged_hours_7d: number
    unread_notifications: number
  }
  projects: Array<{
    id: string
    code: string
    name: string
    company_name: string
    project_manager_name: string
    status: string
    priority: string
    progress: number
    planned_completion_date: string | null
  }>
  my_tasks: Array<{
    id: string
    title: string
    project_id: string
    project_code: string
    project_name: string
    status: string
    priority: string
    progress: number
    due_date: string | null
    is_overdue: boolean
    approval_required: boolean
  }>
  review_queue: Array<{
    id: string
    title: string
    project_id: string
    project_code: string
    priority: string
    owner_name: string
    reviewer_name: string
    due_date: string | null
  }>
  team_workload: Array<{
    id: string
    full_name: string
    email: string
    designation: string | null
    open_tasks: number
    overdue_tasks: number
    estimated_hours: number
  }>
  upcoming_deadlines: Array<{
    id: string
    title: string
    project_id: string
    project_code: string
    status: string
    priority: string
    owner_name: string
    due_date: string | null
    days_until_due: number | null
  }>
  recent_updates: Array<{
    id: string
    task_id: string
    task_title: string
    author_name: string
    progress_percent: number
    work_completed: string
    created_at: string
  }>
  tasks_by_status: Array<{ status: string; count: number }>
  tasks_by_priority: Array<{ priority: string; count: number }>
}

export const dashboardsApi = {
  getCeoDashboard: (companyId?: string) => {
    const qs = companyId ? `?company=${encodeURIComponent(companyId)}` : ''
    return apiRequest<CeoDashboardResponse>(`api/dashboards/ceo/${qs}`)
  },

  getRoleDashboard: () => apiRequest<RoleDashboardResponse>('api/dashboards/role/'),
}
