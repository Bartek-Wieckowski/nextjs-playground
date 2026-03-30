import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail, getOrganizations } from "@/lib/organizations";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (isSuperAdminEmail(user.email ?? "")) {
    redirect("/admin");
  }

  const organizations = await getOrganizations();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition"
                >
                  Wyloguj
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Twoje organizacje
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Organizacje, do których należysz.
          </p>
        </div>

        {organizations.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-400 text-sm">
              Nie należysz jeszcze do żadnej organizacji.
            </p>
            <p className="mt-2 text-gray-400 text-sm">
              Poczekaj aż administrator aktywuje Twoje konto.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {org.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400 font-mono">
                      /{org.slug}
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      org.status === "active"
                        ? "bg-green-100 text-green-700"
                        : org.status === "suspended"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {org.status === "active"
                      ? "Aktywna"
                      : org.status === "suspended"
                        ? "Zawieszona"
                        : "Nieaktywna"}
                  </span>
                </div>

                {org.description && (
                  <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                    {org.description}
                  </p>
                )}

                <p className="mt-4 text-xs text-gray-400">
                  Dołączono:{" "}
                  {new Date(org.created_at).toLocaleDateString("pl-PL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
