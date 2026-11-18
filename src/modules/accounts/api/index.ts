import { apiRequest } from '@/api/client'
import type { LoginRequest, LoginResponse, User, UserStatus } from '@/types'

export interface UserListParams {
  search?: string
  account_status?: UserStatus | ''
  company_id?: string
  department_id?: string
  team_id?: string
}

export interface CreateUserPayload {
  email: string
  username: string
  full_name: string
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
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.department_id) qs.set('department_id', params.department_id)
    if (params?.team_id) qs.set('team_id', params.team_id)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<{ results?: User[] } | User[]>(`api/accounts/users/${query}`)
    return Array.isArray(res) ? res : (res.results ?? [])
  },

  getUser: (id: string) => apiRequest<User>(`api/accounts/users/${id}/`),

  createUser: (data: CreateUserPayload) =>
    apiRequest<User>('api/accounts/users/', { method: 'POST', body: data }),

  updateUser: (id: string, data: Partial<CreateUserPayload>) =>
    apiRequest<User>(`api/accounts/users/${id}/`, { method: 'PATCH', body: data }),

  deactivateUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/accounts/users/${id}/deactivate/`, {
      method: 'POST',
    }),

  activateUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/accounts/users/${id}/activate/`, {
      method: 'POST',
    }),

  suspendUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/accounts/users/${id}/suspend/`, {
      method: 'POST',
    }),

  unlockUser: (id: string) =>
    apiRequest<{ detail: string; user: User }>(`api/accounts/users/${id}/unlock/`, {
      method: 'POST',
    }),
}
