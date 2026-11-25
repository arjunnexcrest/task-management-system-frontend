import { usePermissions } from '@/modules/accounts/hooks/usePermissions'
import { Page as CeoDashboardPage } from '@/modules/dashboards/pages/CeoDashboardPage'
import { Page as RoleDashboardPage } from '@/modules/dashboards/pages/RoleDashboardPage'

export function Page() {
  const { isCEO } = usePermissions()
  return isCEO ? <CeoDashboardPage /> : <RoleDashboardPage />
}
