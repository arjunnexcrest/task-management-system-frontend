import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Reset Password"
      description="Set a new password from a reset token."
      notes={[
    'Validate token from URL',
    'Submit new password',
      ]}
    />
  )
}
