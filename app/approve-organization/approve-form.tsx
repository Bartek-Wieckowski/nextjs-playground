'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { approveOrganizationRequest, type OrgActionState } from '@/lib/actions/organizations'

const initial: OrgActionState = { success: false }

export function ApproveForm({ token }: { token: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    async (prev: OrgActionState, formData: FormData) => {
      const result = await approveOrganizationRequest(prev, formData)
      if (result.success) router.push('/super-admin')
      return result
    },
    initial,
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
      >
        {isPending ? 'Zatwierdzanie...' : 'Zatwierdź i utwórz organizację'}
      </button>
    </form>
  )
}
