import { useMemo } from 'react'
import { useAuth } from '@/modules/accounts/context/AuthContext'
import type { RoleName, User, UserCapabilities } from '@/types'

const ROLE_PRECEDENCE: RoleName[] = [
  'CEO',
  'CompanyInCharge',
  'ProjectManager',
  'DepartmentHead',
  'TeamLeader',
  'Employee',
]

export const ROLE_LABELS: Record<RoleName, string> = {
  CEO: 'Chief Executive Officer',
  CompanyInCharge: 'Company In-Charge',
  ProjectManager: 'Project Manager',
  DepartmentHead: 'Department Head',
  TeamLeader: 'Team Leader',
  Employee: 'Employee',
}

export function normalizeRoleCode(raw?: string | null): RoleName | null {
  if (!raw) return null
  const key = raw.replace(/[\s_-]+/g, '').toLowerCase()
  if (key === 'ceo' || key === 'superadmin' || key === 'superuser') return 'CEO'
  if (key === 'companyincharge' || key === 'companyadmin') return 'CompanyInCharge'
  if (key === 'projectmanager' || key === 'pm') return 'ProjectManager'
  if (key === 'departmenthead' || key === 'depthead') return 'DepartmentHead'
  if (key === 'teamleader' || key === 'teamlead') return 'TeamLeader'
  if (key === 'employee' || key === 'member') return 'Employee'
  return null
}

export function extractUserRoles(user: User | null): RoleName[] {
  if (!user) return []
  const set = new Set<RoleName>()
  if (user.is_superuser) set.add('CEO')
  for (const r of user.roles ?? []) {
    const norm = normalizeRoleCode(r)
    if (norm) set.add(norm)
  }
  const primaryNorm = normalizeRoleCode(user.role)
  if (primaryNorm) set.add(primaryNorm)
  if (set.size === 0) set.add('Employee')
  return ROLE_PRECEDENCE.filter((r) => set.has(r))
}

export function deriveCapabilities(user: User | null): UserCapabilities {
  if (user?.capabilities) return user.capabilities
  const roles = new Set(extractUserRoles(user))
  const ceo = roles.has('CEO') || Boolean(user?.is_superuser)
  const admin = ceo || roles.has('CompanyInCharge')
  const pm = admin || roles.has('ProjectManager')
  const deptHead = admin || roles.has('DepartmentHead')
  const lead = pm || deptHead || roles.has('TeamLeader')

  return {
    can_view_ceo_dashboard: ceo,
    can_manage_companies: ceo,
    can_view_companies: admin,
    can_manage_rbac: ceo,
    can_manage_settings: ceo,
    can_manage_users: admin,
    can_view_employees: lead,
    can_create_departments: admin,
    can_manage_departments: deptHead,
    can_view_departments: lead,
    can_create_teams: deptHead,
    can_manage_teams: deptHead,
    can_manage_team_members: deptHead || roles.has('TeamLeader'),
    can_view_teams: lead,
    can_create_projects: pm,
    can_edit_projects: pm,
    can_delete_projects: admin,
    can_manage_project_assignments: pm || deptHead,
    can_create_tasks: lead,
    can_edit_tasks: lead,
    can_delete_tasks: pm || deptHead,
    can_assign_tasks: lead,
    can_review_tasks: lead,
    can_configure_approval_chains: pm,
    can_view_workload: lead,
    can_view_reports: lead,
    can_manage_risks: lead,
  }
}

export function usePermissions() {
  const { user } = useAuth()

  return useMemo(() => {
    const roles = extractUserRoles(user)
    const primaryRole: RoleName = roles[0] ?? 'Employee'
    const capabilities = deriveCapabilities(user)
    const roleSet = new Set(roles)

    return {
      user,
      roles,
      primaryRole,
      roleLabel: ROLE_LABELS[primaryRole],
      capabilities,
      isCEO: capabilities.can_view_ceo_dashboard,
      isAdmin: capabilities.can_manage_users,
      isPM: roleSet.has('ProjectManager'),
      isDeptHead: roleSet.has('DepartmentHead'),
      isTeamLead: roleSet.has('TeamLeader'),
      isEmployee: primaryRole === 'Employee',
      hasRole: (...allowed: RoleName[]) =>
        capabilities.can_view_ceo_dashboard || allowed.some((r) => roleSet.has(r)),
      can: (cap: keyof UserCapabilities) => Boolean(capabilities[cap]),
    }
  }, [user])
}

