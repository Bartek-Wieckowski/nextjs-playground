"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createOrganization,
  updateOrganization,
  softDeleteOrganization,
  restoreOrganization,
  type OrgActionState,
} from "@/lib/actions/organizations";
import type { Organization } from "@/lib/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktywna",
  suspended: "Zawieszona",
  cancelled: "Anulowana",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── CreateForm ────────────────────────────────────────────────────────────────

const createInitial: OrgActionState = { success: false };

function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: OrgActionState, formData: FormData) => {
      const result = await createOrganization(prev, formData);
      if (result.success) onSuccess();
      return result;
    },
    createInitial,
  );

  return (
    <form
      action={formAction}
      className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6"
    >
      <h3 className="text-sm font-semibold text-blue-800 mb-4">
        Nowa organizacja
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nazwa <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Acme Corp"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Slug <span className="text-gray-400">(auto jeśli pusty)</span>
          </label>
          <input
            name="slug"
            type="text"
            placeholder="acme-corp"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Opis
          </label>
          <input
            name="description"
            type="text"
            placeholder="Opcjonalny opis..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue="active"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="active">Aktywna</option>
            <option value="suspended">Zawieszona</option>
            <option value="cancelled">Anulowana</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600">{state.error}</p>
      )}

      <div className="mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {isPending ? "Tworzenie..." : "Utwórz organizację"}
        </button>
      </div>
    </form>
  );
}

// ── EditRow ───────────────────────────────────────────────────────────────────

const editInitial: OrgActionState = { success: false };

function EditRow({
  org,
  onSuccess,
  onCancel,
}: {
  org: Organization;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    async (prev: OrgActionState, formData: FormData) => {
      const result = await updateOrganization(prev, formData);
      if (result.success) onSuccess();
      return result;
    },
    editInitial,
  );

  return (
    <tr className="bg-yellow-50">
      <td colSpan={6} className="px-4 py-4">
        <form action={formAction}>
          <input type="hidden" name="id" value={org.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nazwa <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                defaultValue={org.name}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                name="slug"
                type="text"
                required
                defaultValue={org.slug}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Opis
              </label>
              <input
                name="description"
                type="text"
                defaultValue={org.description ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={org.status}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="active">Aktywna</option>
                <option value="suspended">Zawieszona</option>
                <option value="cancelled">Anulowana</option>
              </select>
            </div>
          </div>

          {state.error && (
            <p className="mt-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
            >
              {isPending ? "Zapisywanie..." : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Anuluj
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

// ── DeleteButton ──────────────────────────────────────────────────────────────

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`Czy na pewno chcesz usunąć organizację "${name}"?\n\nOrganizacja zostanie przeniesiona do kosza.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await softDeleteOrganization(id);
      if (!result.success) setError(result.error ?? "Błąd usuwania.");
    });
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
      >
        {isPending ? "Usuwanie..." : "Usuń"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── RestoreButton ─────────────────────────────────────────────────────────────

function RestoreButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreOrganization(id);
      if (!result.success) setError(result.error ?? "Błąd przywracania.");
    });
  }

  return (
    <div>
      <button
        onClick={handleRestore}
        disabled={isPending}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-50 transition"
        title={`Przywróć ${name}`}
      >
        {isPending ? "Przywracanie..." : "Przywróć"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── OrganizationsTable ────────────────────────────────────────────────────────

export function OrganizationsTable({
  organizations,
  deletedOrganizations,
}: {
  organizations: Organization[];
  deletedOrganizations: Organization[];
}) {
  const [tab, setTab] = useState<"active" | "deleted">("active");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const current = tab === "active" ? organizations : deletedOrganizations;

  return (
    <div>
      {/* Tabs + toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => { setTab("active"); setShowCreateForm(false); setEditingId(null); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === "active" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Aktywne ({organizations.length})
          </button>
          <button
            onClick={() => { setTab("deleted"); setShowCreateForm(false); setEditingId(null); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === "deleted" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Usunięte ({deletedOrganizations.length})
          </button>
        </div>
        {tab === "active" && (
          <button
            onClick={() => { setShowCreateForm((v) => !v); setEditingId(null); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            {showCreateForm ? "Anuluj" : "+ Nowa organizacja"}
          </button>
        )}
      </div>

      {/* Create form */}
      {tab === "active" && showCreateForm && (
        <CreateForm onSuccess={() => setShowCreateForm(false)} />
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nazwa</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Slug</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Opis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                {tab === "deleted" ? "Usunięta" : "Utworzona"}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {current.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  {tab === "deleted" ? "Brak usuniętych organizacji." : "Brak organizacji. Kliknij \u201e+ Nowa organizacja\u201d aby dodać pierwszą."}
                </td>
              </tr>
            ) : (
              current.map((org) =>
                tab === "active" && editingId === org.id ? (
                  <EditRow
                    key={org.id}
                    org={org}
                    onSuccess={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{org.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{org.slug}</td>
                    <td className="hidden px-4 py-3 text-sm text-gray-500 max-w-xs truncate md:table-cell">
                      {org.description ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={org.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell">
                      {formatDate(tab === "deleted" ? (org.deleted_at ?? org.created_at) : org.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tab === "active" ? (
                          <>
                            <button
                              onClick={() => { setEditingId(org.id); setShowCreateForm(false); }}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
                            >
                              Edytuj
                            </button>
                            <DeleteButton id={org.id} name={org.name} />
                          </>
                        ) : (
                          <RestoreButton id={org.id} name={org.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
