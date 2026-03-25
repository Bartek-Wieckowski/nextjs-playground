import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Multi-Tenant SaaS
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Aplikacja Next.js z Supabase, Magic Link authentication i pełną obsługą 
          organizacji z Row Level Security.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/signup"
            className="rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Zarejestruj się
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold leading-6 text-gray-900"
          >
            Zaloguj się <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="text-3xl mb-2">🔐</div>
            <h3 className="font-semibold text-gray-900">Magic Link Auth</h3>
            <p className="mt-2 text-sm text-gray-600">
              Logowanie bez hasła przez email
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="text-3xl mb-2">🏢</div>
            <h3 className="font-semibold text-gray-900">Multi-Tenant</h3>
            <p className="mt-2 text-sm text-gray-600">
              Wiele organizacji z RLS
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="text-3xl mb-2">🐳</div>
            <h3 className="font-semibold text-gray-900">Local Docker</h3>
            <p className="mt-2 text-sm text-gray-600">
              Testowanie z Supabase lokalnie
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
