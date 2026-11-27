import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import { env } from '@/config/env'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import type { UserCapabilities } from '@/types'

interface NavItem {
  to: string
  label: string
  section: 'Overview' | 'Delivery' | 'Organization' | 'Governance'
  capability?: keyof UserCapabilities
  hideForCeo?: boolean
}

const ALL_NAV_ITEMS: NavItem[] = [
  // Overview
  { to: '/dashboards/ceo', label: 'CEO Dashboard', section: 'Overview', capability: 'can_view_ceo_dashboard' },
  { to: '/dashboards/role', label: 'My Dashboard', section: 'Overview', hideForCeo: true },
  { to: '/tasks/mine', label: 'My Assignments', section: 'Overview' },
  { to: '/notifications', label: 'Notifications', section: 'Overview' },

  // Delivery & Execution
  { to: '/projects', label: 'Projects', section: 'Delivery' },
  { to: '/tasks', label: 'Tasks & Subtasks', section: 'Delivery' },
  { to: '/kanban', label: 'Kanban Board', section: 'Delivery' },
  { to: '/calendar', label: 'Task Calendar', section: 'Delivery' },
  { to: '/reviews', label: 'Review Queue', section: 'Delivery', capability: 'can_review_tasks' },
  { to: '/workload', label: 'Workload View', section: 'Delivery', capability: 'can_view_workload' },
  { to: '/tracking', label: 'Time Tracking', section: 'Delivery' },
  { to: '/reports', label: 'Reports', section: 'Delivery', capability: 'can_view_reports' },
  { to: '/risks', label: 'Risks & Issues', section: 'Delivery', capability: 'can_manage_risks' },

  // Organization
  { to: '/companies', label: 'Companies', section: 'Organization', capability: 'can_view_companies' },
  { to: '/departments', label: 'Departments', section: 'Organization', capability: 'can_view_departments' },
  { to: '/teams', label: 'Teams', section: 'Organization', capability: 'can_view_teams' },
  { to: '/employees', label: 'Employees', section: 'Organization', capability: 'can_view_employees' },
  { to: '/organization', label: 'Org Chart', section: 'Organization', capability: 'can_view_employees' },

  // Governance (CEO Only)
  { to: '/rbac', label: 'Roles & Permissions', section: 'Governance', capability: 'can_manage_rbac' },
  { to: '/settings', label: 'System Settings', section: 'Governance', capability: 'can_manage_settings' },
]

const SECTIONS: NavItem['section'][] = ['Overview', 'Delivery', 'Organization', 'Governance']

export function AppShell() {
  const { user, logout } = useAuth()
  const { isCEO, roleLabel, primaryRole, can } = usePermissions()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.hideForCeo && isCEO) return false
    if (item.capability && !can(item.capability)) return false
    return true
  })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>{env.appName}</strong>
          <span>{roleLabel} Workspace</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {SECTIONS.map((section) => {
            const items = visibleItems.filter((i) => i.section === section)
            if (items.length === 0) return null
            return (
              <div key={section} style={{ display: 'grid', gap: '0.18rem' }}>
                <div
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: 'rgba(148, 163, 184, 0.72)',
                    padding: '0 0.75rem 0.25rem',
                  }}
                >
                  {section}
                </div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  marginBottom: '0.18rem',
                }}
              >
                <span
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
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    padding: '0.12rem 0.45rem',
                    borderRadius: '999px',
                    background: isCEO ? 'rgba(59, 130, 246, 0.24)' : 'rgba(148, 163, 184, 0.2)',
                    color: isCEO ? '#93c5fd' : '#e2e8f0',
                    flexShrink: 0,
                  }}
                >
                  {primaryRole}
                </span>
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
