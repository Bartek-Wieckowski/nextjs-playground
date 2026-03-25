import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInvitationByToken } from '@/lib/organizations'

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token

  if (!token) {
    redirect('/')
  }

  // Pobierz invitation
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Nieprawidłowe zaproszenie
          </h1>
          <p className="text-gray-600 mb-6">
            Link wygasł lub został już użyty.
          </p>
          <a
            href="/"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Wróć do strony głównej
          </a>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Jeśli użytkownik nie jest zalogowany, przekieruj do rejestracji
  if (!user) {
    return <InvitationAcceptForm invitation={invitation} />
  }

  // Użytkownik jest zalogowany - automatycznie akceptuj invite
  redirect(`/invite/process?token=${token}`)
}

function InvitationAcceptForm({ invitation }: { invitation: any }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="rounded-lg bg-white p-8 shadow">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Zostałeś zaproszony!
            </h1>
            {invitation.organizations && (
              <p className="text-gray-600">
                do organizacji <strong>{invitation.organizations.name}</strong>
              </p>
            )}
            {invitation.invitation_type === 'super_admin' && (
              <p className="text-gray-600">
                jako <strong>Super Admin</strong> w CompanyTheBest
              </p>
            )}
          </div>

          <div className="rounded-md bg-blue-50 p-4 mb-6">
            <p className="text-sm text-blue-800">
              📋 Rola: <strong className="capitalize">{invitation.role || 'Super Admin'}</strong>
            </p>
            <p className="text-sm text-blue-800 mt-1">
              📧 Email: <strong>{invitation.email}</strong>
            </p>
          </div>

          <form action="/api/invite/accept" method="POST">
            <input type="hidden" name="token" value={invitation.token} />
            <button
              type="submit"
              className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
            >
              Zaakceptuj zaproszenie i zaloguj się
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            Otrzymasz magic link na email {invitation.email}
          </p>
        </div>
      </div>
    </div>
  )
}
