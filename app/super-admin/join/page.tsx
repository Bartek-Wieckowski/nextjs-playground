import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'
import { acceptSuperAdminInvite } from '@/lib/actions/super-admin'
import { JoinForm } from './join-form'

export default async function SuperAdminJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token?.trim() ?? ''

  if (!token) {
    return <InvalidInvite message="Brak tokenu zaproszenia." />
  }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('super_admin_invites')
    .select('email, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite || invite.status !== 'pending') {
    return <InvalidInvite message="Link nieważny lub wygasł." />
  }

  if (new Date(invite.expires_at) < new Date()) {
    return <InvalidInvite message="Link wygasł." />
  }

  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-3xl mb-4">📨</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Zaproszenie Super Admin</h1>
        <p className="text-sm text-gray-500 mb-1">
          Zaproszenie wysłano na: <strong>{invite.email}</strong>
        </p>
        {user.email?.toLowerCase() !== invite.email.toLowerCase() && (
          <p className="mb-4 text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
            Jesteś zalogowany jako <strong>{user.email}</strong>. To zaproszenie jest dla innego adresu email.
          </p>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Twoje konto <strong>{user.email}</strong> otrzyma uprawnienia Super Admina.
        </p>
        <JoinForm token={token} action={acceptSuperAdminInvite} />
      </div>
    </div>
  )
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="text-3xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Nieprawidłowe zaproszenie</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}
