import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import { env } from '@/config/env'
import { useAuth } from '@/modules/accounts/context/AuthContext'

interface NavItem {
  to: string
  label: string
  ceoOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/dashboards/ceo', label: 'CEO Dashboard', ceoOnly: true },
  { to: '/companies', label: 'Companies', ceoOnly: true },
  { to: '/organization', label: 'Organization' },
  { to: '/departments', label: 'Departments' },
  { to: '/teams', label: 'Teams' },
  { to: '/employees', label: 'Employees' },
  { to: '/rbac', label: 'Roles & Permissions', ceoOnly: true },
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks & Subtasks' },
  { to: '/tasks/mine', label: 'My Assignments' },
  { to: '/kanban', label: 'Kanban Board' },
  { to: '/calendar', label: 'Task Calendar' },
  { to: '/workload', label: 'Workload View' },
  { to: '/tracking', label: 'Time Tracking' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/reports', label: 'Reports' },
  { to: '/risks', label: 'Risks' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isCeo = Boolean(
    user?.is_superuser ||
      (user?.roles ?? []).some((r) => r.toUpperCase() === 'CEO') ||
      user?.role?.toUpperCase() === 'CEO',
  )

  const visibleNavItems = navItems.filter((item) => !item.ceoOnly || isCeo)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>{env.appName}</strong>
          <span>Enterprise Project &amp; Task Suite</span>
        </div>
        <nav>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <Link to={`/employees/${user.id}`} style={{ padding: '0 0.4rem' }}>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.full_name || user.username}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--sidebar-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.email}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#93c5fd',
                  marginTop: '0.15rem',
                }}
              >
                {(user.roles ?? []).join(' · ') || user.role || 'Employee'}
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-sm"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.16)',
                color: '#ffffff',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
