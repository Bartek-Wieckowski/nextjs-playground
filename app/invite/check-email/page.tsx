export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: { email?: string }
}) {
  const email = searchParams.email || 'your email'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
        <div className="text-6xl mb-4">📬</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Sprawdź swoją skrzynkę!
        </h1>
        <p className="text-gray-600 mb-6">
          Wysłaliśmy magic link na adres:
          <br />
          <strong className="text-gray-900">{email}</strong>
        </p>
        <div className="rounded-md bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            💡 Kliknij w link w emailu, aby dokończyć proces akceptacji zaproszenia.
          </p>
        </div>
      </div>
    </div>
  )
}
