'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { generateSlug } from '@/lib/organizations'
import { sendWelcomeEmail } from '@/lib/email'
import { updateTag } from 'next/cache'
import { headers } from 'next/headers'
import {
  CreateOrgSchema,
  UpdateOrgSchema,
  ApproveRequestSchema,
} from '@/lib/schemas/organization'

export type OrgActionState = {
  success: boolean
  error?: string
}

// Wymusza unieważnienie wszystkich sesji usera przez GoTrue Admin REST API.
// Supabase JS SDK nie ma admin.auth.signOut(userId) — używamy fetch bezpośrednio.
async function forceSignOutUser(userId: string) {
  await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}/logout`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
    },
  )
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createOrganization(
  _prevState: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  let currentUser: Awaited<ReturnType<typeof requireSuperAdmin>>
  try {
    currentUser = await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  const parsed = CreateOrgSchema.safeParse({
    name: formData.get('name') ?? '',
    slug: (formData.get('slug') as string) || undefined,
    description: (formData.get('description') as string) || undefined,
    status: formData.get('status') ?? 'active',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { name, slug: customSlug, description, status } = parsed.data
  const admin = createAdminClient()
  const slug = customSlug || generateSlug(name)

  const { error: rpcError } = await admin.rpc('create_organization', {
    p_name: name,
    p_slug: slug,
    p_description: description ?? null,
    p_status: status,
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    if (rpcError.message.includes('SlugTaken'))
      return { success: false, error: `Slug "${slug}" jest już zajęty.` }
    console.error('Error creating organization:', rpcError.message)
    return { success: false, error: 'Błąd tworzenia organizacji.' }
  }

  updateTag('organizations')
  return { success: true }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateOrganization(
  _prevState: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  let currentUser: Awaited<ReturnType<typeof requireSuperAdmin>>
  try {
    currentUser = await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  const parsed = UpdateOrgSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    description: (formData.get('description') as string) || undefined,
    status: formData.get('status') ?? 'active',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { id, name, slug, description, status } = parsed.data
  const admin = createAdminClient()

  const { data: previousStatus, error: rpcError } = await admin.rpc('update_organization', {
    p_id: id,
    p_name: name,
    p_slug: slug,
    p_description: description ?? null,
    p_status: status,
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    if (rpcError.message.includes('SlugTaken'))
      return { success: false, error: `Slug "${slug}" jest już zajęty przez inną organizację.` }
    if (rpcError.message.includes('NotFound'))
      return { success: false, error: 'Organizacja nie istnieje.' }
    console.error('Error updating organization:', rpcError.message)
    return { success: false, error: 'Błąd aktualizacji organizacji.' }
  }

  // forceSignOut poza RPC — to zewnętrzne API (GoTrue), nie SQL
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    const { data: members } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', id)

    if (members?.length) {
      await Promise.allSettled(members.map((m) => forceSignOutUser(m.user_id)))
    }
  }

  updateTag('organizations')
  return { success: true }
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function softDeleteOrganization(id: string): Promise<OrgActionState> {
  let currentUser: Awaited<ReturnType<typeof requireSuperAdmin>>
  try {
    currentUser = await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  if (!id) return { success: false, error: 'Brak ID organizacji.' }

  const admin = createAdminClient()

  const { data: memberIds, error: rpcError } = await admin.rpc('soft_delete_organization', {
    p_id: id,
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    if (rpcError.message.includes('NotFound'))
      return { success: false, error: 'Organizacja nie istnieje lub już usunięta.' }
    console.error('Error deleting organization:', rpcError.message)
    return { success: false, error: 'Błąd usuwania organizacji.' }
  }

  // forceSignOut poza RPC — zewnętrzne API (GoTrue)
  if (memberIds?.length) {
    await Promise.allSettled(memberIds.map((userId: string) => forceSignOutUser(userId)))
  }

  updateTag('organizations')
  updateTag(`audit:${id}`)
  return { success: true }
}

// ── Restore ───────────────────────────────────────────────────────────────────

export async function restoreOrganization(id: string): Promise<OrgActionState> {
  let currentUser: Awaited<ReturnType<typeof requireSuperAdmin>>
  try {
    currentUser = await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  if (!id) return { success: false, error: 'Brak ID organizacji.' }

  const admin = createAdminClient()

  const { error: rpcError } = await admin.rpc('restore_organization', {
    p_id: id,
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    if (rpcError.message.includes('NotFound'))
      return { success: false, error: 'Organizacja nie istnieje lub nie jest usunięta.' }
    console.error('Error restoring organization:', rpcError.message)
    return { success: false, error: 'Błąd przywracania organizacji.' }
  }

  updateTag('organizations')
  updateTag(`audit:${id}`)
  return { success: true }
}

// ── Approve organization request ──────────────────────────────────────────────

export async function approveOrganizationRequest(
  _prevState: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  let currentUser: Awaited<ReturnType<typeof requireSuperAdmin>>
  try {
    currentUser = await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  const parsed = ApproveRequestSchema.safeParse({
    token: formData.get('token') ?? '',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { token } = parsed.data
  const admin = createAdminClient()

  const { data: orgRequest, error: fetchError } = await admin
    .from('organization_requests')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (fetchError || !orgRequest) {
    return { success: false, error: 'Wniosek nie istnieje lub został już rozpatrzony.' }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const origin = `${protocol}://${host}`

  // Znajdź lub utwórz użytkownika w auth (poza transakcją SQL — zewnętrzne API)
  let userId: string
  let userCreatedNow = false

  const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
    email: orgRequest.email,
    email_confirm: true,
    user_metadata: { full_name: orgRequest.full_name },
  })

  if (createUserError) {
    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', orgRequest.email)
      .single()

    if (profileError || !existingProfile) {
      return { success: false, error: `Nie można utworzyć ani znaleźć użytkownika: ${createUserError.message}` }
    }
    userId = existingProfile.id
  } else {
    userId = newUser.user.id
    userCreatedNow = true
  }

  // Jedna atomowa transakcja: tworzy org, dodaje admina, zatwierdza request, audit log
  const slug = generateSlug(orgRequest.organization_name)
  const { data: orgId, error: rpcError } = await admin.rpc('approve_organization_request', {
    p_request_id: orgRequest.id,
    p_org_name: orgRequest.organization_name,
    p_slug: slug,
    p_description: orgRequest.description,
    p_user_id: userId,
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    // Jeśli właśnie stworzyliśmy usera, cofamy — żeby nie zostawić sieroty w auth
    if (userCreatedNow) {
      await admin.auth.admin.deleteUser(userId)
    }
    console.error('Error approving organization request:', rpcError.message)
    return { success: false, error: 'Błąd podczas zatwierdzania wniosku.' }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: orgRequest.email,
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('Error generating magic link:', linkError?.message)
    return { success: false, error: 'Wniosek zatwierdzony, ale nie udało się wysłać emaila powitalnego.' }
  }

  await sendWelcomeEmail({
    fullName: orgRequest.full_name,
    email: orgRequest.email,
    organizationName: orgRequest.organization_name,
    magicLink: linkData.properties.action_link,
  })

  updateTag('organizations')
  updateTag(`audit:${orgId}`)
  return { success: true }
}
