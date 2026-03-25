import Link from 'next/link'
import { SignUpForm } from './signup-form'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Stwórz nowe konto
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Wyślemy Ci magiczny link na email
          </p>
        </div>
        
        <SignUpForm />
        
        <p className="text-center text-sm text-gray-600">
          Masz już konto?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  )
}
