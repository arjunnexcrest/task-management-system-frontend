import { env } from '@/config/env'
import { tokenStorage } from '@/api/client'

const BASE_URL = `${env.apiBaseUrl}/api`

export interface Department {
  id: string
  company: string
  company_name: string
  company_code: string
  name: string
  code: string | null
  status: 'Active' | 'Inactive'
  is_active: boolean
  department_head_id: string | null
  department_head_name: string | null
  department_head_email: string | null
  teams_count: number
  active_members_count: number
  mapped_projects_count: number
  created_at: string
  updated_at: string
}

export interface DepartmentCreatePayload {
  company: string
  name: string
  code?: string | null
  department_head?: string | null
}

export interface DepartmentUpdatePayload {
  name?: string
  code?: string | null
  status?: 'Active' | 'Inactive'
  department_head?: string | null
}

export interface DepartmentListParams {
  company?: string
  status?: string
  search?: string
}

export interface Team {
  id: string
  department: string
  department_name: string
  department_code: string | null
  company_id: string
  company_name: string
  company_code: string
  name: string
  code: string | null
  status: 'Active' | 'Inactive'
  is_active: boolean
  team_leader_id: string | null
  team_leader_name: string | null
  team_leader_email: string | null
  active_members_count: number
  mapped_projects_count: number
  created_at: string
}

export interface TeamCreatePayload {
  department: string
  name: string
  code?: string | null
  team_leader?: string | null
}

export interface TeamUpdatePayload {
  department?: string
  name?: string
  code?: string | null
  status?: 'Active' | 'Inactive'
  team_leader?: string | null
}

export interface TeamListParams {
  company?: string
  department?: string
  status?: string
  search?: string
}

export interface TeamMembershipRecord {
  id: string
  team: string
  team_name: string
  department_id: string
  department_name: string
  user: string
  user_full_name: string
  user_email: string
  is_leader: boolean
  joined_at: string
  left_at: string | null
  status: 'Active' | 'Left'
}

export interface OrgEmployeeNode {
  id: string
  full_name: string
  email: string
  employee_id: string | null
  designation: string | null
  profile_image: string | null
  role: string
  company_id: string
  company_name: string
  company_code: string
  departments: string[]
  teams: string[]
  manager_id: string | null
  manager_name: string | null
  relationship_id: string | null
  direct_reports_count: number
  projects_count: number
  active_tasks_count: number
  overdue_tasks_count: number
  matched: boolean
  is_head?: boolean
  is_leader?: boolean
  children?: OrgEmployeeNode[]
}

export interface OrgTeamNode {
  id: string
  type: 'team'
  department_id: string
  company_id: string
  name: string
  code: string | null
  status: string
  leader: OrgEmployeeNode | null
  members_count: number
  members: OrgEmployeeNode[]
}

export interface OrgDepartmentNode {
  id: string
  type: 'department'
  company_id: string
  name: string
  code: string | null
  status: string
  head: OrgEmployeeNode | null
  teams_count: number
  employees_count: number
  teams: OrgTeamNode[]
  unassigned_members: OrgEmployeeNode[]
}

export interface OrgCompanyNode {
  id: string
  type: 'company'
  name: string
  code: string
  status: string
  ceos: OrgEmployeeNode[]
  incharges: OrgEmployeeNode[]
  project_managers: OrgEmployeeNode[]
  departments_count: number
  teams_count: number
  employees_count: number
  departments: OrgDepartmentNode[]
  unassigned_employees: OrgEmployeeNode[]
}

export interface OrgHierarchyEdge {
  id: string
  company_id: string
  employee_id: string
  manager_id: string
  start_date: string
}

export interface OrganizationHierarchyResponse {
  summary: {
    companies_count: number
    departments_count: number
    teams_count: number
    employees_count: number
    reporting_links_count: number
    matched_employee_ids: string[]
  }
  structure: OrgCompanyNode[]
  reporting_tree: OrgEmployeeNode[]
  nodes: OrgEmployeeNode[]
  edges: OrgHierarchyEdge[]
}

export interface HierarchyEmployeeDetail {
  employee: {
    id: string
    full_name: string
    email: string
    username: string
    employee_id: string | null
    designation: string | null
    profile_image: string | null
    account_status: string
    roles: string[]
    memberships: Array<{
      id: string
      company_id: string
      company_name: string
      company_code: string
      role: string
    }>
  }
  departments: Array<{
    id: string
    department_id: string
    department_name: string
    department_code: string | null
    company_id: string
    company_name: string
    is_head: boolean
    start_date: string | null
  }>
  teams: Array<{
    id: string
    team_id: string
    team_name: string
    team_code: string | null
    department_id: string
    department_name: string
    company_id: string
    is_leader: boolean
  }>
  reporting_managers: Array<{
    relationship_id: string
    id: string
    full_name: string
    email: string
    designation: string | null
    company_id: string
    company_name: string
    start_date: string | null
  }>
  direct_reports: Array<{
    relationship_id: string
    id: string
    full_name: string
    email: string
    employee_id: string | null
    designation: string | null
    company_id: string
    company_name: string
    start_date: string | null
  }>
  reporting_chain: Array<{
    level: number
    id: string
    full_name: string
    email: string
    designation: string | null
    company_id: string
    company_name: string
  }>
  assigned_projects: Array<{
    id: string
    code: string
    name: string
    company_id: string
    company_name: string
    status: string
    priority: string
    progress: number
    role_in_project: string
    is_project_manager: boolean
  }>
  assigned_tasks: Array<{
    id: string
    title: string
    project_id: string
    project_code: string
    project_name: string
    status: string
    priority: string
    due_date: string | null
    progress: number
    is_overdue: boolean
    relation: string
  }>
  task_summary: {
    total: number
    active: number
    completed: number
    overdue: number
    blocked: number
  }
}

function extractApiError(errText: string, status: number, statusText: string): string {
  if (!errText || errText.trim().startsWith('<')) {
    return `HTTP error ${status}: ${statusText}`
  }
  try {
    const parsed = JSON.parse(errText) as Record<string, unknown>
    if (typeof parsed.detail === 'string') return parsed.detail
    if (typeof parsed.error === 'string') return parsed.error
    const messages = Object.entries(parsed)
      .map(([field, val]) => {
        if (Array.isArray(val)) return `${field}: ${val.join(', ')}`
        if (typeof val === 'string') return `${field}: ${val}`
        return null
      })
      .filter(Boolean)
    if (messages.length > 0) return messages.join(' | ')
  } catch {
    // Fall through to raw text
  }
  return errText
}

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
    throw new Error(extractApiError(errText, res.status, res.statusText))
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || []
}

export const organizationApi = {
  listDepartments: async (params?: DepartmentListParams): Promise<Department[]> => {
    const sp = new URLSearchParams()
    if (params?.company) sp.set('company', params.company)
    if (params?.status) sp.set('status', params.status)
    if (params?.search?.trim()) sp.set('search', params.search.trim())
    const qs = sp.toString() ? `?${sp.toString()}` : ''
    const data = await request<Department[] | { results: Department[] }>(`/departments/${qs}`)
    return unwrapList(data)
  },

  getDepartment: (id: string) => request<Department>(`/departments/${id}/`),

  createDepartment: (payload: DepartmentCreatePayload) =>
    request<Department>('/departments/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateDepartment: (id: string, payload: DepartmentUpdatePayload) =>
    request<Department>(`/departments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deactivateDepartment: (id: string) =>
    request<{ detail: string; department: Department }>(`/departments/${id}/deactivate/`, {
      method: 'POST',
    }),

  activateDepartment: (id: string) =>
    request<{ detail: string; department: Department }>(`/departments/${id}/activate/`, {
      method: 'POST',
    }),

  assignDepartmentHead: (deptId: string, userId: string | null) =>
    request<Department>(`/departments/${deptId}/assign_head/`, {
      method: 'POST',
      body: JSON.stringify({ department_head: userId }),
    }),

  transferEmployeeToDepartment: (deptId: string, userId: string, isHead = false) =>
    request<unknown>(`/departments/${deptId}/transfer_employee/`, {
      method: 'POST',
      body: JSON.stringify({ user: userId, is_head: isHead }),
    }),

  // Teams & Team-Leader Assignment (SRS §5.2)
  listTeams: async (params?: TeamListParams): Promise<Team[]> => {
    const sp = new URLSearchParams()
    if (params?.company) sp.set('company', params.company)
    if (params?.department) sp.set('department', params.department)
    if (params?.status) sp.set('status', params.status)
    if (params?.search?.trim()) sp.set('search', params.search.trim())
    const qs = sp.toString() ? `?${sp.toString()}` : ''
    const data = await request<Team[] | { results: Team[] }>(`/teams/${qs}`)
    return unwrapList(data)
  },

  getTeam: (id: string) => request<Team>(`/teams/${id}/`),

  createTeam: (payload: TeamCreatePayload) =>
    request<Team>('/teams/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTeam: (id: string, payload: TeamUpdatePayload) =>
    request<Team>(`/teams/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deactivateTeam: (id: string) =>
    request<{ detail: string; team: Team }>(`/teams/${id}/deactivate/`, {
      method: 'POST',
    }),

  activateTeam: (id: string) =>
    request<{ detail: string; team: Team }>(`/teams/${id}/activate/`, {
      method: 'POST',
    }),

  assignTeamLeader: (teamId: string, userId: string | null) =>
    request<Team>(`/teams/${teamId}/assign_leader/`, {
      method: 'POST',
      body: JSON.stringify({ team_leader: userId }),
    }),

  addTeamMember: (teamId: string, userId: string, isLeader = false) =>
    request<TeamMembershipRecord>(`/teams/${teamId}/add_member/`, {
      method: 'POST',
      body: JSON.stringify({ user: userId, is_leader: isLeader }),
    }),

  removeTeamMember: (teamId: string, userId: string) =>
    request<TeamMembershipRecord>(`/teams/${teamId}/remove_member/`, {
      method: 'POST',
      body: JSON.stringify({ user: userId }),
    }),

  listTeamMembers: async (teamId: string): Promise<TeamMembershipRecord[]> => {
    const data = await request<TeamMembershipRecord[] | { results: TeamMembershipRecord[] }>(
      `/organization/team-memberships/?team=${teamId}&status=Active`,
    )
    return unwrapList(data)
  },

  // Organization Hierarchy & Chart APIs (SRS §1.3, §5.3 & §5.4)
  getHierarchy: (params?: {
    company?: string
    department?: string
    team?: string
    search?: string
    include_inactive?: boolean
  }) => {
    const sp = new URLSearchParams()
    if (params?.company) sp.set('company', params.company)
    if (params?.department) sp.set('department', params.department)
    if (params?.team) sp.set('team', params.team)
    if (params?.search?.trim()) sp.set('search', params.search.trim())
    if (params?.include_inactive) sp.set('include_inactive', 'true')
    const qs = sp.toString() ? `?${sp.toString()}` : ''
    return request<OrganizationHierarchyResponse>(`/organization/hierarchy/${qs}`)
  },

  getHierarchyEmployeeDetail: (userId: string, companyId?: string) => {
    const qs = companyId ? `?company=${companyId}` : ''
    return request<HierarchyEmployeeDetail>(`/organization/hierarchy/employee/${userId}/${qs}`)
  },
}
