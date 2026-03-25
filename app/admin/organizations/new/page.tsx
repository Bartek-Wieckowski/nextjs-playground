import { CreateOrganizationForm } from './create-form'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/organizations'
import { redirect } from 'next/navigation'

export default async function NewOrganizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !(await isSuperAdmin(user.id))) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <a
            href="/admin/dashboard"
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            ← Wróć do dashboardu
          </a>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Stwórz nową organizację
          </h1>
          <CreateOrganizationForm />
        </div>
      </div>
    </div>
  )
}
