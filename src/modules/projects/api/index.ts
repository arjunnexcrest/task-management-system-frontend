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
    if (errText && !errText.trim().startsWith('<')) {
      throw new Error(errText || `HTTP error ${res.status}`)
    }
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
}

export interface LookupData {
  companies: Array<{ id: string; name: string; code: string; status: string }>
  departments: Array<{
    id: string
    company_id: string
    name: string
    code: string
    status: string
    department_head_id?: string | null
    department_head_name?: string | null
  }>
  teams: Array<{
    id: string
    department_id: string
    department_name?: string
    company_id?: string
    name: string
    code: string
    status: string
    team_leader_id?: string | null
    team_leader_name?: string | null
    active_members_count?: number
    member_ids?: string[]
  }>
  users: Array<{
    id: string
    email: string
    username: string
    full_name: string
    employee_id: string
    designation: string | null
    account_status: string
    company_ids?: string[]
    department_ids?: string[]
    department_names?: string[]
    team_ids?: string[]
    team_names?: string[]
  }>
}

export interface ProjectMember {
  id: string
  project: string
  user: string
  user_full_name: string
  user_email: string
  user_designation?: string | null
  user_employee_id?: string
  is_project_manager?: boolean
  department_name?: string | null
  team_names?: string[]
  owned_tasks_count?: number
  role_in_project: string
  status: string
  joined_at: string
  left_at: string | null
}

export interface ProjectDepartment {
  id: string
  project: string
  department: string
  department_name: string
  department_code?: string | null
  department_head_id?: string | null
  department_head_name?: string | null
  created_at: string
}

export interface ProjectTeam {
  id: string
  project: string
  team: string
  team_name: string
  team_code?: string | null
  department_id?: string
  department_name?: string
  team_leader_id?: string | null
  team_leader_name?: string | null
  active_members_count?: number
  participating_members_count?: number
  created_at: string
}

export interface ProjectPhase {
  id: string
  project: string
  name: string
  start_date: string | null
  end_date: string | null
  owner: string | null
  owner_name: string | null
  status: 'Not Started' | 'In Progress' | 'Completed'
  progress: string | number
}

export interface MilestoneTask {
  id: string
  milestone: string
  task: string
  task_title: string
  task_status: string
}

export interface MilestoneDependency {
  id: string
  milestone: string
  depends_on_milestone: string
  depends_on_title: string
}

export interface ProjectMilestone {
  id: string
  project: string
  title: string
  description: string | null
  target_date: string
  owner: string | null
  owner_name: string | null
  completion_criteria: string | null
  status: 'Pending' | 'In Progress' | 'Completed' | 'Delayed'
  approval_required: boolean
  progress: string | number
  milestone_tasks: MilestoneTask[]
  dependencies: MilestoneDependency[]
}

export interface Project {
  id: string
  company: string
  company_name: string
  company_code: string
  project_manager: string | null
  project_manager_name: string | null
  name: string
  code: string
  description: string | null
  start_date: string | null
  planned_completion_date: string | null
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  status:
    | 'Draft'
    | 'Planned'
    | 'Active'
    | 'On Hold'
    | 'At Risk'
    | 'Delayed'
    | 'Completed'
    | 'Cancelled'
    | 'Archived'
  objectives: string | null
  deliverables: string | null
  budget: string | number | null
  progress: string | number
  created_at: string
  closed_at: string | null
  closure_remarks: string | null
  tasks_count: number
  completed_tasks_count: number
  department_ids?: string[]
  team_ids?: string[]
  member_ids?: string[]
  initial_phases?: Array<{
    name: string
    start_date?: string | null
    end_date?: string | null
    owner?: string | null
    status?: string
  }>
  initial_milestones?: Array<{
    title: string
    target_date: string
    description?: string | null
    owner?: string | null
    completion_criteria?: string | null
    approval_required?: boolean
  }>
  departments_summary?: Array<{
    id: string
    department_id: string
    name: string
    code: string
  }>
  teams_summary?: Array<{
    id: string
    team_id: string
    name: string
    code: string
  }>
  members_count?: number
}

export interface ProjectDashboardSummary {
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  pending_tasks: number
  blocked_tasks: number
  overdue_tasks: number
  department_progress: Array<{
    department_id: string
    department_name: string
    total_tasks: number
    completed_tasks: number
    progress: number
  }>
  team_progress: Array<{
    team_id: string
    team_name: string
    total_tasks: number
    completed_tasks: number
    progress: number
  }>
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
  project_departments: ProjectDepartment[]
  project_teams: ProjectTeam[]
  phases: ProjectPhase[]
  milestones: ProjectMilestone[]
  dashboard_summary?: ProjectDashboardSummary
}

export interface ParticipatingTeamRosterMember {
  user_id: string
  full_name: string
  email: string
  designation: string | null
  is_leader: boolean
  is_project_member: boolean
  project_member_id: string | null
  role_in_project: string | null
  participation_status: string
  assigned_tasks_count: number
}

export interface ParticipatingTeamDetail {
  id: string
  team_id: string
  name: string
  code: string | null
  department_id: string
  department_name: string
  team_leader: {
    id: string
    full_name: string
    email: string
    designation: string | null
  } | null
  active_team_members_count: number
  participating_members_count?: number
  team_members?: ParticipatingTeamRosterMember[]
  tasks_count: number
  completed_tasks_count: number
  in_progress_tasks_count?: number
  overdue_tasks_count?: number
  progress: number
  created_at: string
}

export interface ProjectParticipationMember {
  id: string
  user: string
  user_full_name: string
  user_email: string
  user_employee_id?: string
  user_designation: string | null
  department_id?: string | null
  department_name?: string | null
  teams?: Array<{
    team_id: string
    team_name: string
    team_code: string | null
    department_id: string
    department_name: string
    is_leader: boolean
  }>
  is_project_manager?: boolean
  role_in_project: string
  status: string
  owned_tasks_count: number
  assigned_tasks_count?: number
  completed_tasks_count?: number
  in_progress_tasks_count?: number
  overdue_tasks_count?: number
  estimated_effort_hours?: number
  other_active_projects_count?: number
  other_active_projects?: Array<{
    project_id: string
    code: string
    name: string
    status: string
    role_in_project: string
  }>
  joined_at: string
  left_at: string | null
}

export interface ProjectAssignmentHierarchy {
  project_id: string
  project_code: string
  project_name: string
  status: string
  priority: string
  company: {
    id: string
    name: string
    code: string
  }
  project_manager: {
    id: string
    full_name: string
    email: string
    designation: string | null
  } | null
  summary?: {
    participating_departments_count: number
    participating_teams_count: number
    active_members_count: number
    historical_members_count: number
    total_tasks_count: number
  }
  participating_departments: Array<{
    id: string
    department_id: string
    name: string
    code: string | null
    status: string
    department_head: {
      id: string
      full_name: string
      email: string
      designation: string | null
    } | null
    participating_teams: ParticipatingTeamDetail[]
    tasks_count: number
    completed_tasks_count: number
    progress: number
    created_at: string
  }>
  participating_teams?: ParticipatingTeamDetail[]
  members: ProjectParticipationMember[]
}

export interface UserProjectParticipation {
  membership_id: string
  project_id: string
  project_code: string
  project_name: string
  project_status: string
  project_priority: string
  project_progress: number
  company_id: string
  company_name: string
  company_code: string
  project_manager_name: string | null
  role_in_project: string
  participation_status: string
  owned_tasks_count: number
  completed_tasks_count: number
  joined_at: string
  left_at: string | null
}

export interface OrganizationDepartment {
  id: string
  company: string
  company_name: string
  company_code: string
  name: string
  code: string | null
  status: string
  department_head_id: string | null
  department_head_name: string | null
  teams_count: number
  active_members_count: number
  mapped_projects_count: number
  created_at: string
}

export interface OrganizationTeam {
  id: string
  department: string
  department_name: string
  company_id: string
  company_name: string
  name: string
  code: string | null
  status: string
  team_leader_id: string | null
  team_leader_name: string | null
  active_members_count: number
  mapped_projects_count: number
  created_at: string
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || []
}

export const projectsApi = {
  getLookup: () => request<LookupData>('/lookup/'),

  listProjects: async (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    const data = await request<Project[] | { results: Project[] }>(`/projects/${query}`)
    return unwrapList(data)
  },

  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}/`),

  createProject: (payload: Partial<Project>) =>
    request<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (id: string, payload: Partial<Project>) =>
    request<Project>(`/projects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteProject: (id: string) =>
    request<void>(`/projects/${id}/`, {
      method: 'DELETE',
    }),

  archiveProject: (id: string) =>
    request<ProjectDetail>(`/projects/${id}/archive/`, {
      method: 'POST',
    }),

  closeProject: (id: string, closureRemarks: string) =>
    request<ProjectDetail>(`/projects/${id}/close_project/`, {
      method: 'POST',
      body: JSON.stringify({ closure_remarks: closureRemarks }),
    }),

  recalculateProgress: (id: string) =>
    request<ProjectDetail>(`/projects/${id}/recalculate_progress/`, {
      method: 'POST',
    }),

  // SRS §6.3 Project Assignment & Participation Workflow Endpoints
  assignProjectManager: (
    id: string,
    payload: { project_manager: string | null; auto_activate?: boolean },
  ) =>
    request<ProjectDetail>(`/projects/${id}/assign_manager/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  mapProjectDepartments: (
    id: string,
    payload: { department_ids: string[]; replace?: boolean; auto_add_heads?: boolean },
  ) =>
    request<ProjectDetail>(`/projects/${id}/map_departments/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  mapProjectTeams: (
    id: string,
    payload: {
      team_ids: string[]
      replace?: boolean
      auto_map_departments?: boolean
      auto_add_leaders?: boolean
      auto_add_team_members?: boolean
    },
  ) =>
    request<ProjectDetail>(`/projects/${id}/map_teams/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncProjectTeamMembers: (
    id: string,
    payload?: { team_id?: string; team_ids?: string[] },
  ) =>
    request<
      ProjectDetail & {
        sync_result?: {
          synced_count: number
          newly_added_count: number
          reactivated_count: number
          team_ids: string[]
        }
      }
    >(`/projects/${id}/sync_team_members/`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  assignProjectMembers: (
    id: string,
    payload: {
      members?: Array<{ user: string; role_in_project: string }>
      member_ids?: string[]
      replace?: boolean
    },
  ) =>
    request<ProjectDetail>(`/projects/${id}/assign_members/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAssignmentHierarchy: (id: string) =>
    request<ProjectAssignmentHierarchy>(`/projects/${id}/assignment_hierarchy/`),

  getProjectParticipation: (id: string) =>
    request<ProjectAssignmentHierarchy>(`/projects/${id}/participation/`),

  getUserParticipations: (userId: string, companyId?: string) => {
    const params = new URLSearchParams({ user: userId })
    if (companyId) params.set('company', companyId)
    return request<UserProjectParticipation[]>(
      `/projects/user_participations/?${params.toString()}`,
    )
  },

  listPhases: async (projectId?: string) => {
    const query = projectId ? `?project=${projectId}` : ''
    const data = await request<ProjectPhase[] | { results: ProjectPhase[] }>(
      `/projects/phases/${query}`,
    )
    return unwrapList(data)
  },

  createPhase: (payload: Partial<ProjectPhase>) =>
    request<ProjectPhase>('/projects/phases/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePhase: (id: string) =>
    request<void>(`/projects/phases/${id}/`, {
      method: 'DELETE',
    }),

  listMilestones: async (projectId?: string) => {
    const query = projectId ? `?project=${projectId}` : ''
    const data = await request<ProjectMilestone[] | { results: ProjectMilestone[] }>(
      `/projects/milestones/${query}`,
    )
    return unwrapList(data)
  },

  createMilestone: (payload: Partial<ProjectMilestone>) =>
    request<ProjectMilestone>('/projects/milestones/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMilestone: (id: string) =>
    request<void>(`/projects/milestones/${id}/`, {
      method: 'DELETE',
    }),

  addProjectMember: (payload: { project: string; user: string; role_in_project: string }) =>
    request<ProjectMember>('/projects/members/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProjectMember: (
    memberRecordId: string,
    payload: { role_in_project?: string; status?: string },
  ) =>
    request<ProjectMember>(`/projects/members/${memberRecordId}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  reactivateProjectMember: (memberRecordId: string, roleInProject?: string) =>
    request<ProjectMember>(`/projects/members/${memberRecordId}/reactivate/`, {
      method: 'POST',
      body: JSON.stringify(roleInProject ? { role_in_project: roleInProject } : {}),
    }),

  removeProjectMember: (memberRecordId: string) =>
    request<ProjectMember>(`/projects/members/${memberRecordId}/`, {
      method: 'DELETE',
    }),

  // Organization Department & Team Management APIs (SRS Module 3)
  listDepartments: async (companyId?: string) => {
    const query = companyId ? `?company=${companyId}` : ''
    const data = await request<OrganizationDepartment[] | { results: OrganizationDepartment[] }>(
      `/organization/departments/${query}`,
    )
    return unwrapList(data)
  },

  createDepartment: (payload: {
    company: string
    name: string
    code?: string
    department_head?: string | null
  }) =>
    request<OrganizationDepartment>('/organization/departments/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  assignDepartmentHead: (deptId: string, userId: string | null) =>
    request<OrganizationDepartment>(`/organization/departments/${deptId}/assign_head/`, {
      method: 'POST',
      body: JSON.stringify({ department_head: userId }),
    }),

  transferEmployeeToDepartment: (deptId: string, userId: string, isHead = false) =>
    request<unknown>(`/organization/departments/${deptId}/transfer_employee/`, {
      method: 'POST',
      body: JSON.stringify({ user: userId, is_head: isHead }),
    }),

  listTeams: async (departmentId?: string) => {
    const query = departmentId ? `?department=${departmentId}` : ''
    const data = await request<OrganizationTeam[] | { results: OrganizationTeam[] }>(
      `/organization/teams/${query}`,
    )
    return unwrapList(data)
  },

  createTeam: (payload: {
    department: string
    name: string
    code?: string
    team_leader?: string | null
  }) =>
    request<OrganizationTeam>('/organization/teams/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  assignTeamLeader: (teamId: string, userId: string | null) =>
    request<OrganizationTeam>(`/organization/teams/${teamId}/assign_leader/`, {
      method: 'POST',
      body: JSON.stringify({ team_leader: userId }),
    }),
}
