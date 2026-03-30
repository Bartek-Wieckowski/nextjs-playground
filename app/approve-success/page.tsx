export default function ApproveSuccessPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Organizacja została utworzona!
        </h1>
        <p className="text-gray-500 mb-8">
          Konto użytkownika jest gotowe. Na podany adres email został wysłany
          link do pierwszego logowania.
        </p>
        <a
          href="/admin"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Wróć do panelu admina
        </a>
      </div>
    </div>
  );
}
