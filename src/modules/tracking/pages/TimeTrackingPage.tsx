import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Time Tracking"
      description="Manual entries and start/stop timers."
      notes={[
    'One active timer per employee',
      ]}
    />
  )
}
