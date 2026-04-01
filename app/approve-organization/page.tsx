import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { ApproveForm } from './approve-form'

export default async function ApproveOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token?.trim() ?? ''

  await requireSuperAdmin()

  if (!token) {
    return <ErrorPage message="Brak tokenu w URL." />
  }

  const admin = createAdminClient()
  const { data: orgRequest } = await admin
    .from('organization_requests')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!orgRequest) {
    return <ErrorPage message="Wniosek nie istnieje lub został już rozpatrzony." />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-3xl mb-4">🏢</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Zatwierdź wniosek</h1>
        <p className="text-sm text-gray-500 mb-6">
          Przejrzyj szczegóły i zatwierdź wniosek o założenie organizacji.
        </p>

        <table className="w-full text-sm mb-6">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2.5 pr-4 font-medium text-gray-500 w-40">Imię i nazwisko</td>
              <td className="py-2.5 text-gray-900">{orgRequest.full_name}</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-medium text-gray-500">Email</td>
              <td className="py-2.5 text-gray-900">{orgRequest.email}</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-medium text-gray-500">Organizacja</td>
              <td className="py-2.5 font-semibold text-gray-900">{orgRequest.organization_name}</td>
            </tr>
            {orgRequest.description && (
              <tr>
                <td className="py-2.5 pr-4 font-medium text-gray-500">Opis</td>
                <td className="py-2.5 text-gray-900">{orgRequest.description}</td>
              </tr>
            )}
            <tr>
              <td className="py-2.5 pr-4 font-medium text-gray-500">Zgłoszono</td>
              <td className="py-2.5 text-gray-500">
                {new Date(orgRequest.created_at).toLocaleDateString('pl-PL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </td>
            </tr>
          </tbody>
        </table>

        <ApproveForm token={token} />
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="text-3xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Błąd</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}
