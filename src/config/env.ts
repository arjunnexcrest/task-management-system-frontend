/**
 * Typed access to Vite environment variables.
 * Copy `.env.example` to `.env` and adjust values locally.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
  appName:
    import.meta.env.VITE_APP_NAME || 'Project & Task Management System',
  isDev: (import.meta.env.VITE_APP_ENV || 'development') === 'development',
} as const
