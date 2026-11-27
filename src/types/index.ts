/** Shared domain types — expand as API contracts stabilize. */

export type UserStatus =
  | 'Active'
  | 'Inactive'
  | 'PendingActivation'
  | 'Suspended'
  | 'Deactivated'

export interface ReportingManagerSummary {
  relationship_id?: string
  id: string
  full_name: string
  email: string
  designation: string | null
  company_id: string
  company_name?: string
  start_date?: string | null
}

export interface CompanyMembershipSummary {
  id: string
  company: string
  company_name: string
  company_code: string
  role: string
  is_active: boolean
  joined_at: string | null
}

export interface EmployeeDepartmentSummary {
  id: string
  department_id: string
  department_name: string
  department_code: string | null
  company_id: string
  company_name: string
  is_head: boolean
  start_date: string | null
}

export interface EmployeeTeamSummary {
  id: string
  team_id: string
  team_name: string
  team_code: string | null
  department_id: string
  department_name: string
  company_id: string
  is_leader: boolean
  joined_at: string | null
}

export interface DirectReportSummary {
  relationship_id: string
  id: string
  full_name: string
  email: string
  employee_id: string | null
  designation: string | null
  company_id: string
  company_name: string
  start_date: string | null
}

export interface ReportingChainNode {
  level: number
  relationship_id: string
  id: string
  full_name: string
  email: string
  designation: string | null
  company_id: string
  company_name: string
}

export interface ReportingHistoryEntry {
  id: string
  company_id: string
  company_name: string
  manager_id: string
  manager_name: string
  manager_email: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

export interface ReportingRelationshipRecord {
  id: string
  company: string
  company_name: string
  company_code: string
  employee: string
  employee_name: string
  employee_email: string
  employee_designation: string | null
  manager: string
  manager_name: string
  manager_email: string
  manager_designation: string | null
  start_date: string
  end_date: string | null
  is_active: boolean
}

export interface HierarchyNode {
  id: string
  full_name: string
  email: string
  employee_id: string | null
  designation: string | null
  role: string
  company_id: string
  company_name: string
  company_code: string
  departments: string[]
  teams: string[]
  manager_id: string | null
  relationship_id: string | null
}

export interface HierarchyEdge {
  id: string
  company_id: string
  employee_id: string
  manager_id: string
  start_date: string
}

export interface ReportingHierarchyResponse {
  nodes: HierarchyNode[]
  edges: HierarchyEdge[]
}

export interface UserCapabilities {
  can_view_ceo_dashboard: boolean
  can_manage_companies: boolean
  can_view_companies: boolean
  can_manage_rbac: boolean
  can_manage_settings: boolean
  can_manage_users: boolean
  can_view_employees: boolean
  can_create_departments: boolean
  can_manage_departments: boolean
  can_view_departments: boolean
  can_create_teams: boolean
  can_manage_teams: boolean
  can_manage_team_members: boolean
  can_view_teams: boolean
  can_create_projects: boolean
  can_edit_projects: boolean
  can_delete_projects: boolean
  can_manage_project_assignments: boolean
  can_create_tasks: boolean
  can_edit_tasks: boolean
  can_delete_tasks: boolean
  can_assign_tasks: boolean
  can_review_tasks: boolean
  can_configure_approval_chains: boolean
  can_view_workload: boolean
  can_view_reports: boolean
  can_manage_risks: boolean
}

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  company?: string | null
  company_name?: string | null
  role?: string
  capabilities?: UserCapabilities
  memberships?: CompanyMembershipSummary[]
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

export interface EmployeeProfileDetail extends User {
  departments: EmployeeDepartmentSummary[]
  teams: EmployeeTeamSummary[]
  direct_reports: DirectReportSummary[]
  reporting_chain: ReportingChainNode[]
  reporting_history: ReportingHistoryEntry[]
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
