"use client";

import { useState, useTransition } from "react";
import { signOut } from "@/lib/actions/auth";
import { deleteOwnAccount } from "@/lib/actions/members";
import { MembersTable } from "@/app/dashboard/components/members-table";
import type { Organization, OrganizationMember, OrganizationMemberWithProfile } from "@/lib/types";

type OrgWithMembership = {
  membership: Pick<OrganizationMember, "role" | "status">;
  org: Organization;
};

type AdminOrgWithMembers = {
  org: Organization;
  members: OrganizationMemberWithProfile[];
};

// ── DeleteAccountButton ───────────────────────────────────────────────────────

function DeleteAccountButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        "Czy na pewno chcesz usunąć swoje konto?\n\nTa operacja jest nieodwracalna. Wszystkie Twoje dane zostaną trwale usunięte.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOwnAccount();
      if (result && !result.success) setError(result.error ?? "Błąd usuwania konta.");
    });
  }

  return (
    <div className="mt-10 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <h3 className="text-sm font-semibold text-red-800 mb-1">Strefa niebezpieczna</h3>
      <p className="text-xs text-red-600 mb-3">
        Usunięcie konta jest nieodwracalne. Stracisz dostęp do wszystkich organizacji.
      </p>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
      >
        {isPending ? "Usuwanie..." : "Usuń konto"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// ── DashboardTabs ─────────────────────────────────────────────────────────────

export function DashboardTabs({
  userEmail,
  orgs,
  adminOrgMembers,
}: {
  userEmail: string;
  orgs: OrgWithMembership[];
  adminOrgMembers: AdminOrgWithMembers[];
}) {
  const isAdmin = adminOrgMembers.length > 0;
  const [tab, setTab] = useState<"orgs" | "users">("orgs");

  const hasSuspendedMembership = orgs.some((m) => m.membership.status === "suspended");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{userEmail}</span>
              <form action={signOut}>
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

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {hasSuspendedMembership && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-amber-800">
              Twój dostęp do jednej lub więcej organizacji został zawieszony.
              Skontaktuj się z administratorem organizacji.
            </p>
          </div>
        )}

        {/* Tabs — only visible to admins */}
        {isAdmin && (
          <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
            <button
              onClick={() => setTab("orgs")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === "orgs" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Moje organizacje
            </button>
            <button
              onClick={() => setTab("users")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === "users" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Użytkownicy
            </button>
          </div>
        )}

        {/* Organizations tab */}
        {tab === "orgs" && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Twoje organizacje</h2>
              <p className="mt-1 text-sm text-gray-500">Organizacje, do których należysz.</p>
            </div>

            {orgs.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <p className="text-gray-400 text-sm">Nie należysz jeszcze do żadnej organizacji.</p>
                <p className="mt-2 text-gray-400 text-sm">
                  Poczekaj aż administrator aktywuje Twoje konto.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {orgs.map(({ org, membership }) => {
                  const isSuspended =
                    org.status !== "active" || membership.status === "suspended";
                  return (
                    <div
                      key={org.id}
                      className={`rounded-xl border bg-white p-6 shadow-sm transition ${
                        isSuspended
                          ? "border-red-200 opacity-70"
                          : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{org.name}</h3>
                          <p className="mt-0.5 text-xs text-gray-400 font-mono">/{org.slug}</p>
                        </div>
                        <div className="ml-3 shrink-0 flex flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                                : "Anulowana"}
                          </span>
                          {membership.role === "admin" && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                              Admin
                            </span>
                          )}
                          {membership.status === "suspended" && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                              Twój dostęp zawieszony
                            </span>
                          )}
                        </div>
                      </div>

                      {org.description && (
                        <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                          {org.description}
                        </p>
                      )}

                      {isSuspended && (
                        <p className="mt-3 text-xs text-red-500">
                          Dostęp do tej organizacji jest aktualnie niedostępny.
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
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Users tab */}
        {tab === "users" && isAdmin && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Użytkownicy</h2>
              <p className="mt-1 text-sm text-gray-500">
                Zarządzaj użytkownikami w swoich organizacjach.
              </p>
            </div>
            <MembersTable adminOrgs={adminOrgMembers} />
          </>
        )}

        <DeleteAccountButton />
      </main>
    </div>
  );
}
