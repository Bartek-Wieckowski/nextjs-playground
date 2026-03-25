import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SuperAdminRegisterForm } from './register-form'

export default async function SuperAdminRegisterPage() {
  const cookieStore = await cookies()
  const secretFromCookie = cookieStore.get('super_admin_access')?.value
  const expectedSecret = process.env.SUPER_ADMIN_SECRET

  // Middleware już sprawdził secret i ustawił cookie
  // Tutaj tylko weryfikujemy czy cookie jest poprawny
  if (secretFromCookie !== expectedSecret) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center">
            <span className="text-2xl text-white">🔐</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Rejestracja Super Admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            CompanyTheBest - Panel zarządzania
          </p>
          <div className="mt-4 rounded-md bg-purple-50 p-4">
            <p className="text-xs text-purple-800">
              ⚠️ Ten formularz jest tylko dla pracowników CompanyTheBest.
              Otrzymasz email z magicznym linkiem do dokończenia rejestracji.
            </p>
          </div>
        </div>
        
        <SuperAdminRegisterForm />
      </div>
    </div>
  )
}
