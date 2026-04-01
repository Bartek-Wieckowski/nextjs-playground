import { requireSuperAdmin } from "@/lib/auth";
import {
  getAllOrganizations,
  getDeletedOrganizations,
} from "@/lib/dal/organizations";
import { OrganizationsTable } from "./components/organizations-table";
import { SuperAdminInviteSection } from "./components/super-admin-invite-section";
import { signOut } from "@/lib/actions/auth";
import type { Organization } from "@/lib/types";

export default async function SuperAdminPage() {
  const user = await requireSuperAdmin();

  const [organizations, deletedOrganizations] = await Promise.all([
    getAllOrganizations(),
    getDeletedOrganizations(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-gray-900">
                Panel Admina
              </span>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                Super Admin
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
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

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizacje</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zarządzaj wszystkimi organizacjami w systemie.
          </p>
        </div>

        <OrganizationsTable
          organizations={organizations as Organization[]}
          deletedOrganizations={deletedOrganizations}
        />

        <SuperAdminInviteSection />
      </main>
    </div>
  );
}
