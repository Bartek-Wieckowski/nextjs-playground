"use client";

import { useActionState, useState, useTransition, useEffect, useRef } from "react";
import {
  updateMember,
  removeMember,
  addMember,
  type MemberActionState,
} from "@/lib/actions/members";
import type { OrganizationMemberWithProfile, Organization } from "@/lib/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const MEMBER_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-600",
};

const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: "Aktywny",
  suspended: "Zawieszony",
};

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  member: "bg-gray-100 text-gray-600",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Członek",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── EditRow ───────────────────────────────────────────────────────────────────

const editInitial: MemberActionState = { success: false };

function EditRow({
  member,
  orgId,
  onSuccess,
  onCancel,
}: {
  member: OrganizationMemberWithProfile;
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    async (prev: MemberActionState, formData: FormData) => {
      const result = await updateMember(prev, formData);
      if (result.success) onSuccess();
      return result;
    },
    editInitial,
  );

  return (
    <tr className="bg-yellow-50">
      <td colSpan={5} className="px-4 py-4">
        <form action={formAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="orgId" value={orgId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Imię i nazwisko <span className="text-red-500">*</span>
              </label>
              <input
                name="fullName"
                type="text"
                required
                defaultValue={member.profiles?.full_name ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Rola
              </label>
              <select
                name="role"
                defaultValue={member.role}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="member">Członek</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={member.status}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="active">Aktywny</option>
                <option value="suspended">Zawieszony</option>
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

// ── RemoveButton ──────────────────────────────────────────────────────────────

function RemoveButton({
  memberId,
  orgId,
  name,
}: {
  memberId: string;
  orgId: string;
  name: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    if (
      !window.confirm(
        `Czy na pewno chcesz usunąć użytkownika "${name}" z organizacji?`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await removeMember(memberId, orgId);
      if (!result.success) setError(result.error ?? "Błąd usuwania.");
    });
  }

  return (
    <div>
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
      >
        {isPending ? "Usuwanie..." : "Usuń"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── AddMemberModal ────────────────────────────────────────────────────────────

const addInitial: MemberActionState = { success: false };

function AddMemberModal({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (prev: MemberActionState, formData: FormData) => {
      const result = await addMember(prev, formData);
      if (result.success) {
        onClose();
      }
      return result;
    },
    addInitial,
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="rounded-2xl border border-gray-200 shadow-xl backdrop:bg-black/40 p-0 w-full max-w-md"
    >
      <div className="p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Dodaj nowego użytkownika
        </h3>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orgId" value={orgId} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Imię i nazwisko <span className="text-red-500">*</span>
            </label>
            <input
              name="fullName"
              type="text"
              required
              placeholder="Jan Kowalski"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="jan@firma.pl"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isPending ? "Dodawanie..." : "Dodaj i wyślij zaproszenie"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

// ── MembersTable ──────────────────────────────────────────────────────────────

export function MembersTable({
  adminOrgs,
}: {
  adminOrgs: Array<{
    org: Organization;
    members: OrganizationMemberWithProfile[];
  }>;
}) {
  const [selectedOrgId, setSelectedOrgId] = useState(adminOrgs[0]?.org.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const currentOrg = adminOrgs.find((o) => o.org.id === selectedOrgId);
  const members = currentOrg?.members ?? [];

  return (
    <div>
      {/* Org selector + toolbar */}
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {adminOrgs.length > 1 && (
            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setEditingId(null);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {adminOrgs.map(({ org }) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          {adminOrgs.length === 1 && (
            <span className="text-sm font-medium text-gray-700">
              {currentOrg?.org.name}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {members.length} {members.length === 1 ? "użytkownik" : "użytkowników"}
          </span>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setEditingId(null); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          + Dodaj użytkownika
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Imię i nazwisko
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Rola
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                Dołączył
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  Brak użytkowników. Kliknij „+ Dodaj użytkownika" aby dodać pierwszego.
                </td>
              </tr>
            ) : (
              members.map((member) =>
                editingId === member.id ? (
                  <EditRow
                    key={member.id}
                    member={member}
                    orgId={selectedOrgId}
                    onSuccess={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {member.profiles?.full_name ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {member.profiles?.email ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[member.role] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${MEMBER_STATUS_STYLES[member.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {MEMBER_STATUS_LABELS[member.status] ?? member.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingId(member.id);
                          }}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
                        >
                          Edytuj
                        </button>
                        <RemoveButton
                          memberId={member.id}
                          orgId={selectedOrgId}
                          name={member.profiles?.full_name ?? member.profiles?.email ?? member.id}
                        />
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddMemberModal
          orgId={selectedOrgId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
