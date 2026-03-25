import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSuperAdmin, getOrganizations } from '@/lib/organizations'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Sprawdź czy to super admin
  const isSuper = await isSuperAdmin(user.id)
  if (!isSuper) {
    redirect('/dashboard')
  }

  // Pobierz wszystkie organizacje (super admin widzi wszystkie)
  const organizations = await getOrganizations()

  // Pobierz profil super admina
  const { data: superAdminProfile } = await supabase
    .from('super_admins')
    .select('*, profiles(*)')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <nav className="bg-white shadow-sm border-b-2 border-purple-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center">
                <span className="text-white font-bold">SA</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-xs text-gray-500">CompanyTheBest</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {superAdminProfile?.profiles?.first_name} {superAdminProfile?.profiles?.last_name}
                </p>
                <p className="text-xs text-gray-500">{superAdminProfile?.position}</p>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Wyloguj
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-sm font-medium text-gray-500">Organizacje</div>
            <div className="mt-2 text-3xl font-bold text-purple-600">
              {organizations.length}
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-sm font-medium text-gray-500">Twoja rola</div>
            <div className="mt-2 text-xl font-bold text-gray-900">
              Super Admin
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="text-sm font-medium text-gray-500">Status</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-full bg-green-400"></span>
              <span className="text-sm font-semibold text-gray-900">Aktywny</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Szybkie akcje</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <a
              href="/admin/organizations/new"
              className="rounded-md bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-purple-500"
            >
              + Stwórz organizację
            </a>
            <a
              href="/admin/invitations/new"
              className="rounded-md bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              📧 Wyślij zaproszenie
            </a>
            <a
              href="/admin/users"
              className="rounded-md bg-gray-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-gray-500"
            >
              👥 Zarządzaj użytkownikami
            </a>
          </div>
        </div>

        {/* Organizations List */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Wszystkie organizacje
          </h2>

          {organizations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Brak organizacji. Stwórz pierwszą!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <a
                  key={org.id}
                  href={`/admin/organizations/${org.id}`}
                  className="block rounded-lg border border-gray-200 p-4 hover:border-purple-500 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{org.name}</h4>
                      <p className="text-sm text-gray-500">/{org.slug}</p>
                      {org.industry && (
                        <p className="text-xs text-gray-400 mt-1">
                          Branża: {org.industry}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">
                        {new Date(org.created_at).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
