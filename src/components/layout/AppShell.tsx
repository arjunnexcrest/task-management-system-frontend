import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import { env } from '@/config/env'
import { useAuth } from '@/modules/accounts/context/AuthContext'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks & Subtasks' },
  { to: '/tasks/mine', label: 'My Assignments' },
  { to: '/kanban', label: 'Kanban Board' },
  { to: '/calendar', label: 'Task Calendar' },
  { to: '/workload', label: 'Workload View' },
  { to: '/departments', label: 'Departments' },
  { to: '/teams', label: 'Teams' },
  { to: '/employees', label: 'Employees' },
  { to: '/dashboards/ceo', label: 'CEO Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/organization', label: 'Organization' },
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
          {navItems.map((item) => (
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
