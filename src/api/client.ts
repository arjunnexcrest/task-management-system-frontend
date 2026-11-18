import { env } from '@/config/env'

const ACCESS_KEY = 'tms_access'
const REFRESH_KEY = 'tms_refresh'

export const tokenStorage = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string | null
}

async function rawRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, headers, ...rest } = options
  const url = path.startsWith('http')
    ? path
    : `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const response = await fetch(url, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let data: unknown = null
  if (text && !text.trim().startsWith('<')) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { detail: text }
    }
  }

  if (!response.ok) {
    throw new ApiError(
      `API ${response.status}: ${response.statusText}`,
      response.status,
      data,
    )
  }

  return data as T
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) throw new ApiError('No refresh token', 401, null)

  const data = await rawRequest<{ access: string; refresh: string }>(
    'api/auth/refresh/',
    { method: 'POST', body: { refresh } },
  )
  tokenStorage.set(data.access, data.refresh)
  return data.access
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (options.token !== undefined) {
    return rawRequest<T>(path, options)
  }

  const access = tokenStorage.getAccess()
  try {
    return await rawRequest<T>(path, { ...options, token: access })
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      tokenStorage.getRefresh()
    ) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      try {
        const newAccess = await refreshPromise
        return await rawRequest<T>(path, { ...options, token: newAccess })
      } catch {
        tokenStorage.clear()
        throw new ApiError('Session expired. Please log in again.', 401, null)
      }
    }
    throw err
  }
}
