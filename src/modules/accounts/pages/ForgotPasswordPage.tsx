import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Forgot Password"
      description="Request a password reset email."
      notes={[
    'Wire to password-reset endpoint',
      ]}
    />
  )
}
