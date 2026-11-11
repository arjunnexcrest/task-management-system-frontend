import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Project Overview"
      description="Project dashboard with progress and risk summary."
      notes={[
    'Completion %, overdue, blocked counts',
      ]}
    />
  )
}
