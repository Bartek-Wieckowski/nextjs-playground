'use client'

import { useActionState } from 'react'
import type { SuperAdminActionState } from '@/lib/actions/super-admin'

type Props = {
  token: string
  action: (prev: SuperAdminActionState, formData: FormData) => Promise<SuperAdminActionState>
}

const initial: SuperAdminActionState = { success: false }

export function JoinForm({ token, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, initial)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
          Imię i nazwisko
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          autoComplete="name"
          placeholder="Jan Kowalski"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
      >
        {isPending ? 'Akceptowanie...' : 'Akceptuj zaproszenie'}
      </button>
    </form>
  )
}
