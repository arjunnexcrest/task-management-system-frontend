import { NavLink, Outlet } from 'react-router-dom'
import { env } from '@/config/env'

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
  { to: '/dashboards/ceo', label: 'CEO Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/organization', label: 'Organization' },
  { to: '/tracking', label: 'Time Tracking' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/reports', label: 'Reports' },
  { to: '/risks', label: 'Risks' },
  { to: '/settings', label: 'Settings' },
  { to: '/login', label: 'Login' },
]

export function AppShell() {
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
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
