"use client";

import { useActionState } from "react";
import { inviteSuperAdmin, type SuperAdminActionState } from "@/lib/actions/super-admin";

const initial: SuperAdminActionState = { success: false };

export function SuperAdminInviteSection() {
  const [state, formAction, isPending] = useActionState(inviteSuperAdmin, initial);

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
      <h2 className="text-sm font-semibold text-purple-800 mb-1">Zaproś Super Admina</h2>
      <p className="text-xs text-purple-600 mb-4">
        Wyślij zaproszenie na adres email. Link wygaśnie po 7 dniach.
      </p>
      <form action={formAction} className="flex items-start gap-3">
        <div className="flex-1">
          <input
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          {state.error && <p className="mt-1.5 text-xs text-red-600">{state.error}</p>}
          {state.success && <p className="mt-1.5 text-xs text-green-600">Zaproszenie wysłane.</p>}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
        >
          {isPending ? "Wysyłanie..." : "Wyślij zaproszenie"}
        </button>
      </form>
    </div>
  );
}
