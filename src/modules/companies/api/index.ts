import { apiRequest } from '@/api/client'

export interface Company {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  is_active: boolean
  status: 'Active' | 'Inactive' | 'Archived'
  logo: string | null
  members_count: number
  created_at: string
  updated_at: string
}

export interface CompanyPayload {
  name: string
  code?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  is_active?: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CompanyMembershipRecord {
  id: string
  user: string
  user_full_name: string
  user_email: string
  user_designation: string | null
  user_is_active: boolean
  company: string
  company_name: string
  company_code: string
  company_is_active: boolean
  role: string
  is_active: boolean
  status: 'Active' | 'Inactive'
  joined_at: string
  left_at: string | null
}

export const companiesApi = {
  list: async (params?: { search?: string; is_active?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.is_active) qs.set('is_active', params.is_active)
    if (params?.page) qs.set('page', String(params.page))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<PaginatedResponse<Company> | Company[]>(
      `api/companies/${query}`,
    )
    if (Array.isArray(res)) {
      return { count: res.length, next: null, previous: null, results: res }
    }
    return res
  },

  myCompanies: () => apiRequest<Company[]>('api/companies/my-companies/'),

  get: (id: string) => apiRequest<Company>(`api/companies/${id}/`),

  create: (data: CompanyPayload) =>
    apiRequest<Company>('api/companies/', {
      method: 'POST',
      body: data,
    }),

  update: (id: string, data: Partial<CompanyPayload>) =>
    apiRequest<Company>(`api/companies/${id}/`, {
      method: 'PATCH',
      body: data,
    }),

  softDelete: (id: string) =>
    apiRequest<void>(`api/companies/${id}/`, {
      method: 'DELETE',
    }),

  listMembers: (companyId: string, isActive?: boolean) => {
    const qs = isActive === undefined ? '' : `?is_active=${String(isActive)}`
    return apiRequest<CompanyMembershipRecord[]>(`api/companies/${companyId}/members/${qs}`)
  },

  addMember: (companyId: string, payload: { user: string; role: string }) =>
    apiRequest<CompanyMembershipRecord>(`api/companies/${companyId}/members/`, {
      method: 'POST',
      body: payload,
    }),
}

export const membershipsApi = {
  list: async (params?: { company?: string; user?: string; role?: string; is_active?: string }) => {
    const qs = new URLSearchParams()
    if (params?.company) qs.set('company', params.company)
    if (params?.user) qs.set('user', params.user)
    if (params?.role) qs.set('role', params.role)
    if (params?.is_active) qs.set('is_active', params.is_active)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<
      PaginatedResponse<CompanyMembershipRecord> | CompanyMembershipRecord[]
    >(`api/memberships/${query}`)
    return Array.isArray(res) ? res : (res.results ?? [])
  },

  create: (payload: { user: string; company: string; role: string }) =>
    apiRequest<CompanyMembershipRecord>('api/memberships/', {
      method: 'POST',
      body: payload,
    }),

  updateRole: (membershipId: string, role: string) =>
    apiRequest<CompanyMembershipRecord>(`api/memberships/${membershipId}/`, {
      method: 'PATCH',
      body: { role },
    }),

  deactivate: (membershipId: string) =>
    apiRequest<{ detail: string; membership: CompanyMembershipRecord }>(
      `api/memberships/${membershipId}/deactivate/`,
      { method: 'POST' },
    ),

  activate: (membershipId: string) =>
    apiRequest<{ detail: string; membership: CompanyMembershipRecord }>(
      `api/memberships/${membershipId}/activate/`,
      { method: 'POST' },
    ),
}
