'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrganizationRequestEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'
import { headers } from 'next/headers'

export type RequestFormState = {
  success: boolean
  error?: string
}

export async function submitOrganizationRequest(
  _prevState: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const fullName = (formData.get('fullName') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const organizationName = (formData.get('organizationName') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() ?? ''

  // Walidacja
  if (!fullName) {
    return { success: false, error: 'Imię i nazwisko jest wymagane.' }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Podaj poprawny adres email.' }
  }
  if (!organizationName) {
    return { success: false, error: 'Nazwa organizacji jest wymagana.' }
  }

  const admin = createAdminClient()

  // Zapis wniosku (service role omija RLS)
  const { data: orgRequest, error: dbError } = await admin
    .from('organization_requests')
    .insert({
      full_name: fullName,
      email,
      organization_name: organizationName,
      description: description || null,
    })
    .select('id, token')
    .single()

  if (dbError || !orgRequest) {
    console.error('DB error saving request:', dbError)
    return { success: false, error: 'Błąd zapisu. Spróbuj ponownie.' }
  }

  await logAudit({
    action: 'org_request_submitted',
    table: 'organization_requests',
    rowId: orgRequest.id,
    changedBy: null,
    newData: { email, organization_name: organizationName },
  })

  // Buduj URL do zatwierdzenia
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`
  const approveUrl = `${origin}/approve-organization?token=${orgRequest.token}`

  // Wyślij email do właściciela firmy
  try {
    await sendOrganizationRequestEmail({
      fullName,
      email,
      organizationName,
      description,
      approveUrl,
    })
  } catch (emailError) {
    console.error('Email error:', emailError)
    // Wniosek zapisany, ale email nie poszedł — logujemy, nie blokujemy użytkownika
  }

  return { success: true }
}
