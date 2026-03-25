import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrganizations, isSuperAdmin } from "@/lib/organizations";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Sprawdź czy to super admin i przekieruj
  const isSuper = await isSuperAdmin(user.id);
  if (isSuper) {
    redirect("/admin/dashboard");
  }

  const organizations = await getOrganizations();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <h1 className="text-xl font-bold">Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{user.email}</span>
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Witaj!</h2>
          <p className="mt-2 text-gray-600">
            Zarządzaj swoimi organizacjami i zespołami.
          </p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Twoje organizacje
              </h3>
              <Link
                href="/organizations/new"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                + Nowa organizacja
              </Link>
            </div>

            {organizations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  Nie należysz do żadnej organizacji.
                </p>
                <p className="text-sm text-gray-400">
                  Poczekaj na zaproszenie od administratora organizacji.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {organizations.map((org) => (
                  <Link
                    key={org.id}
                    href={`/organizations/${org.id}`}
                    className="block rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {org.name}
                        </h4>
                        <p className="text-sm text-gray-500">/{org.slug}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-blue-50 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Jak działa multi-tenancy?
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Każda organizacja ma własną izolowaną przestrzeń</li>
              <li>• Row Level Security (RLS) zapewnia bezpieczeństwo danych</li>
              <li>• Użytkownicy mogą należeć do wielu organizacji</li>
              <li>• Różne role: owner, admin, member</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
