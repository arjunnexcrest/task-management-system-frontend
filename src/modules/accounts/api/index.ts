import { apiRequest } from '@/api/client'
import type {
  DirectReportSummary,
  EmployeeProfileDetail,
  LoginRequest,
  LoginResponse,
  ReportingChainNode,
  ReportingHierarchyResponse,
  ReportingRelationshipRecord,
  User,
  UserStatus,
} from '@/types'

export interface UserListParams {
  search?: string
  account_status?: UserStatus | ''
  company?: string
  company_id?: string
  role?: string
  is_active?: string
  department_id?: string
  team_id?: string
}

export interface CreateUserPayload {
  email: string
  username?: string
  full_name: string
  company?: string | null
  role?: string
  employee_id?: string
  designation?: string
  phone?: string
  password?: string
  account_status?: UserStatus
  is_active?: boolean
  is_staff?: boolean
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiRequest<LoginResponse>('api/accounts/login/', {
      method: 'POST',
      body: data,
      token: null,
    }),

  logout: (refresh: string) =>
    apiRequest<{ detail: string }>('api/accounts/logout/', {
      method: 'POST',
      body: { refresh },
    }),

  getMe: () => apiRequest<User>('api/accounts/me/'),

  updateMe: (data: Partial<Pick<User, 'full_name' | 'phone' | 'designation'>>) =>
    apiRequest<User>('api/accounts/me/', { method: 'PATCH', body: data }),

  changePassword: (data: { old_password: string; new_password: string }) =>
    apiRequest<{ detail: string }>('api/accounts/change-password/', {
      method: 'POST',
      body: data,
    }),

  forgotPassword: (email: string) =>
    apiRequest<{ detail: string }>('api/accounts/forgot-password/', {
      method: 'POST',
      body: { email },
      token: null,
    }),

  resetPassword: (data: { uid: string; token: string; new_password: string }) =>
    apiRequest<{ detail: string }>('api/accounts/reset-password/', {
      method: 'POST',
      body: data,
      token: null,
    }),

  activateAccount: (data: { uid: string; token: string; password?: string }) =>
    apiRequest<{ detail: string }>('api/accounts/activate/', {
      method: 'POST',
      body: data,
      token: null,
    }),

  listUsers: async (params?: UserListParams) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.account_status) qs.set('account_status', params.account_status)
    if (params?.company) qs.set('company', params.company)
    if (params?.company_id) qs.set('company', params.company_id)
    if (params?.role) qs.set('role', params.role)
    if (params?.is_active) qs.set('is_active', params.is_active)
    if (params?.department_id) qs.set('department_id', params.department_id)
    if (params?.team_id) qs.set('team_id', params.team_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<{ results?: User[] } | User[]>(`api/users/${query}`)
    return Array.isArray(res) ? res : (res.results ?? [])
  },

  getUser: (id: string) => apiRequest<User>(`api/users/${id}/`),

  createUser: (data: CreateUserPayload) =>
    apiRequest<User>('api/users/', { method: 'POST', body: data }),

  updateUser: (id: string, data: Partial<CreateUserPayload>) =>
    apiRequest<User>(`api/users/${id}/`, { method: 'PATCH', body: data }),

  deactivateUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/users/${id}/deactivate/`, {
      method: 'POST',
    }),

  activateUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/users/${id}/activate/`, {
      method: 'POST',
    }),

  suspendUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/users/${id}/suspend/`, {
      method: 'POST',
    }),

  unlockUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/users/${id}/unlock/`, {
      method: 'POST',
    }),

  // Employee Profile & Reporting-Manager APIs (SRS §5.3)
  getEmployeeProfile: (id: string) =>
    apiRequest<EmployeeProfileDetail>(`api/employees/${id}/profile/`),

  updateEmployeeProfile: (
    id: string,
    data: Partial<
      Pick<User, 'full_name' | 'phone' | 'designation' | 'profile_image' | 'employee_id'>
    >,
  ) =>
    apiRequest<EmployeeProfileDetail>(`api/employees/${id}/profile/`, {
      method: 'PATCH',
      body: data,
    }),

  getDirectReports: (id: string, companyId?: string) => {
    const qs = companyId ? `?company=${companyId}` : ''
    return apiRequest<{ count: number; results: DirectReportSummary[] }>(
      `api/employees/${id}/direct-reports/${qs}`,
    )
  },

  getReportingChain: (id: string, companyId?: string) => {
    const qs = companyId ? `?company=${companyId}` : ''
    return apiRequest<{ employee_id: string; chain: ReportingChainNode[] }>(
      `api/employees/${id}/reporting-chain/${qs}`,
    )
  },

  assignReportingManager: (
    employeeId: string,
    payload: { company?: string; manager: string | null; start_date?: string },
  ) =>
    apiRequest<ReportingRelationshipRecord | { detail: string; ended_count: number }>(
      `api/employees/${employeeId}/reporting-manager/`,
      {
        method: 'POST',
        body: payload,
      },
    ),

  endReportingManager: (employeeId: string, companyId?: string) => {
    const qs = companyId ? `?company=${companyId}` : ''
    return apiRequest<{ detail: string; ended_count: number }>(
      `api/employees/${employeeId}/reporting-manager/${qs}`,
      { method: 'DELETE' },
    )
  },

  listReportingRelationships: async (params?: {
    company?: string
    employee?: string
    manager?: string
    active_only?: boolean
    search?: string
  }) => {
    const qs = new URLSearchParams()
    if (params?.company) qs.set('company', params.company)
    if (params?.employee) qs.set('employee', params.employee)
    if (params?.manager) qs.set('manager', params.manager)
    if (params?.active_only) qs.set('active_only', 'true')
    if (params?.search) qs.set('search', params.search)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<
      { results?: ReportingRelationshipRecord[] } | ReportingRelationshipRecord[]
    >(`api/reporting-relationships/${query}`)
    return Array.isArray(res) ? res : (res.results ?? [])
  },

  createReportingRelationship: (payload: {
    company: string
    employee: string
    manager: string
    start_date?: string
  }) =>
    apiRequest<ReportingRelationshipRecord>('api/reporting-relationships/', {
      method: 'POST',
      body: payload,
    }),

  endReportingRelationship: (id: string, endDate?: string) =>
    apiRequest<{ detail: string; relationship: ReportingRelationshipRecord }>(
      `api/reporting-relationships/${id}/end/`,
      {
        method: 'POST',
        body: endDate ? { end_date: endDate } : {},
      },
    ),

  getReportingHierarchy: (params?: {
    company?: string
    department?: string
    team?: string
  }) => {
    const qs = new URLSearchParams()
    if (params?.company) qs.set('company', params.company)
    if (params?.department) qs.set('department', params.department)
    if (params?.team) qs.set('team', params.team)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest<ReportingHierarchyResponse>(
      `api/reporting-relationships/hierarchy/${query}`,
    )
  },
}
