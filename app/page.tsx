"use client";

import { useActionState } from "react";
import { submitOrganizationRequest } from "@/lib/actions/request-organization";

const initialState = { success: false, error: undefined };

export default function Home() {
  const [state, formAction, isPending] = useActionState(
    submitOrganizationRequest,
    initialState,
  );

  if (state.success) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Wniosek wysłany!
          </h2>
          <p className="text-gray-600">
            Twój wniosek o założenie organizacji został przyjęty. Właściciel
            systemu wkrótce go przejrzy i skontaktuje się z&nbsp;Tobą.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Załóż organizację
          </h1>
          <p className="mt-3 text-gray-500">
            Wypełnij formularz, a my skontaktujemy się z&nbsp;Tobą w&nbsp;celu
            uruchomienia Twojego konta.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form action={formAction} className="space-y-5">
            {/* Full name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Imię i nazwisko <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Jan Kowalski"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Adres email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="jan@firma.pl"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Organization name */}
            <div>
              <label
                htmlFor="organizationName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nazwa organizacji <span className="text-red-500">*</span>
              </label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                placeholder="Moja Firma Sp. z o.o."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Opis{" "}
                <span className="text-gray-400 font-normal">(opcjonalnie)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="Krótko opisz swoją organizację i czego potrzebujesz..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
              />
            </div>

            {/* Error message */}
            {state.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {state.error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPending ? "Wysyłanie..." : "Wyślij wniosek"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Masz już konto?{" "}
          <a
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Zaloguj się
          </a>
        </p>
      </div>
    </div>
  );
}
