import { Link, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import type { RoleName, UserCapabilities } from '@/types'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: RoleName[]
  requiredCapability?: keyof UserCapabilities
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requiredCapability,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const { primaryRole, roleLabel, hasRole, can } = usePermissions()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: '0.9rem',
        }}
      >
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const deniedByRole = allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)
  const deniedByCap = requiredCapability && !can(requiredCapability)

  if (deniedByRole || deniedByCap) {
    return (
      <div className="page-container">
        <div
          className="card"
          style={{
            maxWidth: 640,
            margin: '3rem auto',
            borderColor: '#fecaca',
            background: '#ffffff',
          }}
        >
          <p className="eyebrow" style={{ color: '#991b1b' }}>
            403 · Role-Based Access Control
          </p>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.45rem' }}>
            Access Restricted for {roleLabel}
          </h1>
          <p style={{ color: 'var(--muted)', margin: '0 0 1.25rem', fontSize: '0.92rem' }}>
            Your current role (<strong>{primaryRole}</strong>) does not have permission to view or
            manage this section. Please return to your authorized dashboard or contact your
            administrator if you need elevated privileges.
          </p>
          <div className="btn-row">
            <Link to="/" className="btn btn-primary">
              Go to My Dashboard
            </Link>
            <Link to="/tasks/mine" className="btn">
              My Assignments
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
