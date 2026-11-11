import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Project and Task Management"
      description="React frontend starter mapped to SRS modules and the Django API."
      notes={[
    'Implement screens under src/modules',
    'Use src/api/client.ts for HTTP',
    'Backend runs at VITE_API_BASE_URL',
      ]}
    />
  )
}
