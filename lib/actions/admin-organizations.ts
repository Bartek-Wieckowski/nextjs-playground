'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminEmail, generateSlug } from '@/lib/organizations'
import { revalidatePath } from 'next/cache'

// ── Guard ─────────────────────────────────────────────────────────────────────

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isSuperAdminEmail(user.email ?? '')) {
    throw new Error('Forbidden')
  }

  return user
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrgActionState = {
  success: boolean
  error?: string
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createOrganization(
  _prevState: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  try {
    await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const customSlug = (formData.get('slug') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() ?? ''
  const status = (formData.get('status') as string | null) ?? 'active'

  if (!name) {
    return { success: false, error: 'Nazwa organizacji jest wymagana.' }
  }

  const validStatuses = ['active', 'inactive', 'suspended']
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Nieprawidłowy status.' }
  }

  const admin = createAdminClient()

  const slug = customSlug || generateSlug(name)

  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return { success: false, error: `Slug "${slug}" jest już zajęty.` }
  }

  const { error } = await admin.from('organizations').insert({
    name,
    slug,
    description: description || null,
    status,
  })

  if (error) {
    console.error('Error creating organization:', error)
    return { success: false, error: 'Błąd tworzenia organizacji.' }
  }

  revalidatePath('/admin')
  return { success: true }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateOrganization(
  _prevState: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  try {
    await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  const id = (formData.get('id') as string | null)?.trim() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() ?? ''
  const status = (formData.get('status') as string | null) ?? 'active'

  if (!id) return { success: false, error: 'Brak ID organizacji.' }
  if (!name) return { success: false, error: 'Nazwa organizacji jest wymagana.' }
  if (!slug) return { success: false, error: 'Slug jest wymagany.' }

  const validStatuses = ['active', 'inactive', 'suspended']
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Nieprawidłowy status.' }
  }

  const admin = createAdminClient()

  // Sprawdź czy slug nie należy do innej organizacji
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle()

  if (existing) {
    return { success: false, error: `Slug "${slug}" jest już zajęty przez inną organizację.` }
  }

  const { error } = await admin
    .from('organizations')
    .update({
      name,
      slug,
      description: description || null,
      status,
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating organization:', error)
    return { success: false, error: 'Błąd aktualizacji organizacji.' }
  }

  revalidatePath('/admin')
  return { success: true }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteOrganization(id: string): Promise<OrgActionState> {
  try {
    await requireSuperAdmin()
  } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  if (!id) return { success: false, error: 'Brak ID organizacji.' }

  const admin = createAdminClient()

  const { error } = await admin.from('organizations').delete().eq('id', id)

  if (error) {
    console.error('Error deleting organization:', error)
    return { success: false, error: 'Błąd usuwania organizacji.' }
  }

  revalidatePath('/admin')
  return { success: true }
}
