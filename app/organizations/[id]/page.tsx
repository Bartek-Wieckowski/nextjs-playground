import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrganization, getOrganizationMembers } from '@/lib/organizations'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export default async function OrganizationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const organization = await getOrganization(id)
  const members = await getOrganizationMembers(id)

  if (!organization) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Dashboard
              </Link>
              <h1 className="text-xl font-bold">{organization.name}</h1>
            </div>
            <span className="text-sm text-gray-700">{user.email}</span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informacje o organizacji
            </h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nazwa</dt>
                <dd className="text-sm text-gray-900">{organization.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Slug</dt>
                <dd className="text-sm text-gray-900">/{organization.slug}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ID</dt>
                <dd className="text-sm font-mono text-gray-900">{organization.id}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Członkowie ({members.length})
              </h2>
            </div>

            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.profiles.first_name && member.profiles.last_name
                        ? `${member.profiles.first_name} ${member.profiles.last_name}`
                        : member.profiles.email}
                    </p>
                    <p className="text-sm text-gray-500">{member.profiles.email}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-green-50 p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Gratulacje!
            </h3>
            <p className="text-sm text-green-800">
              Masz działający system multi-tenant z Row Level Security. 
              Każda organizacja ma własne izolowane dane, a użytkownicy widzą 
              tylko te organizacje, do których należą.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
