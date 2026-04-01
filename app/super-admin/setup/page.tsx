import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'
import { completeSuperAdminSetup } from '@/lib/actions/super-admin'
import { BootstrapForm } from './bootstrap-form'

export default async function SuperAdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ bootstrap_token?: string }>
}) {
  const params = await searchParams
  const token = params.bootstrap_token?.trim() ?? ''

  if (!process.env.BOOTSTRAP_SETUP_TOKEN) notFound()
  if (token !== process.env.BOOTSTRAP_SETUP_TOKEN) notFound()

  const user = await getCurrentUser()
  const admin = createAdminClient()

  const { count } = await admin
    .from('super_admins')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="text-3xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Setup zakończony</h1>
          <p className="text-sm text-gray-500">Super admin już istnieje w systemie.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-3xl mb-4">🔐</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Bootstrap Super Admina</h1>
        <p className="text-sm text-gray-500 mb-6">
          Konto <strong>{user.email}</strong> zostanie oznaczone jako Super Admin.
        </p>
        <BootstrapForm token={token} action={completeSuperAdminSetup} />
      </div>
    </div>
  )
}
