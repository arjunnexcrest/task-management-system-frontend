import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Employee Profile"
      description="View and edit employee profile details."
      notes={[
    'Show reporting manager',
    'Show assigned projects and tasks',
      ]}
    />
  )
}
