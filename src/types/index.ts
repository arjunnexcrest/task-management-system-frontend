/** Shared domain types — expand as API contracts stabilize. */

export type UserStatus =
  | 'Active'
  | 'Inactive'
  | 'PendingActivation'
  | 'Suspended'
  | 'Deactivated'

export interface ReportingManagerSummary {
  id: string
  full_name: string
  email: string
  designation: string | null
  company_id: string
}

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  employee_id: string | null
  designation: string | null
  phone: string | null
  profile_image: string | null
  account_status: UserStatus
  is_active: boolean
  is_staff: boolean
  is_superuser?: boolean
  failed_login_attempts?: number
  locked_until?: string | null
  roles?: string[]
  company_ids?: string[]
  department_names?: string[]
  team_names?: string[]
  reporting_managers?: ReportingManagerSummary[]
  direct_reports_count?: number
  created_at: string
  updated_at: string
  date_joined: string
  last_login: string | null
}

export interface TokenPair {
  access: string
  refresh: string
}

export interface LoginRequest {
  identifier: string
  password: string
}

export interface LoginResponse extends TokenPair {
  user: User
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export type RoleName =
  | 'CEO'
  | 'CompanyInCharge'
  | 'ProjectManager'
  | 'DepartmentHead'
  | 'TeamLeader'
  | 'Employee'

export type ProjectStatus =
  | 'Draft'
  | 'Planned'
  | 'Active'
  | 'OnHold'
  | 'AtRisk'
  | 'Delayed'
  | 'Completed'
  | 'Cancelled'
  | 'Archived'

export type TaskStatus =
  | 'Backlog'
  | 'ToDo'
  | 'Assigned'
  | 'InProgress'
  | 'OnHold'
  | 'Blocked'
  | 'InReview'
  | 'ChangesRequested'
  | 'Approved'
  | 'Completed'
  | 'Cancelled'

export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export type StubModule = {
  id: string
  title: string
  description: string
  path: string
}
