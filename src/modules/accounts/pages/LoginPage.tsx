import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export function Page() {
  return (
    <PlaceholderPage
      title="Login"
      description="Authenticate users against the Django accounts API."
      notes={[
    'Wire to POST /api/accounts/login/',
    'Store JWT or session token',
    'Redirect by role after login',
      ]}
    />
  )
}
