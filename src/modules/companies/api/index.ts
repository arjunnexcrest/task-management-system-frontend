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
}
