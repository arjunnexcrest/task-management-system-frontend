import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { tokenStorage, ApiError } from '@/api/client'
import { authApi } from '@/modules/accounts/api'
import type { User, LoginRequest } from '@/types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginRequest) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    if (!tokenStorage.getAccess()) {
      setIsLoading(false)
      return
    }

    authApi
      .getMe()
      .then(setUser)
      .catch(() => {
        tokenStorage.clear()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (data: LoginRequest): Promise<User> => {
    const response = await authApi.login(data)
    tokenStorage.set(response.access, response.refresh)
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh()
    setUser(null)
    tokenStorage.clear()
    if (refresh) {
      authApi.logout(refresh).catch(() => null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.getMe()
      setUser(me)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
        tokenStorage.clear()
      }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
