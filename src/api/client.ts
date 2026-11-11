import { env } from '@/config/env'

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

/**
 * Thin fetch wrapper for the Django REST API.
 * Endpoint helpers will be added by module owners under src/modules/<name>/api.
 */
export async function apiRequest<T>(
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
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(
      `API ${response.status}: ${response.statusText}`,
      response.status,
      data,
    )
  }

  return data as T
}
