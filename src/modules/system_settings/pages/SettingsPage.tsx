import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="System Settings"
      description="Workflow rules, general settings, and import/export."
      notes={[
    'Status transitions',
    'Reminder intervals',
      ]}
    />
  )
}
