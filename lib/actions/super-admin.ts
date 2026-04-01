'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth'
import { sendSuperAdminInviteEmail } from '@/lib/email'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  BootstrapSchema,
  InviteSchema,
  AcceptInviteSchema,
} from '@/lib/schemas/super-admin'

export type SuperAdminActionState = {
  success: boolean
  error?: string
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function completeSuperAdminSetup(
  _prevState: SuperAdminActionState,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await getCurrentUser()

  const parsed = BootstrapSchema.safeParse({
    bootstrap_token: formData.get('bootstrap_token') ?? '',
    full_name: formData.get('full_name') ?? '',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const envToken = process.env.BOOTSTRAP_SETUP_TOKEN
  if (!envToken) return { success: false, error: 'Bootstrap nie jest skonfigurowany.' }
  if (parsed.data.bootstrap_token !== envToken) return { success: false, error: 'Nieprawidłowy token.' }

  const { full_name } = parsed.data
  const admin = createAdminClient()

  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { is_super_admin: true },
    user_metadata: { full_name },
  })

  if (metaError) {
    console.error('Error setting app_metadata:', metaError)
    return { success: false, error: 'Błąd ustawiania uprawnień.' }
  }

  // Atomowa transakcja: profil + super_admin + audit log + guard "tylko jeden bootstrap"
  const { error: rpcError } = await admin.rpc('complete_super_admin_setup', {
    p_user_id: user.id,
    p_email: user.email ?? '',
    p_full_name: full_name,
  })

  if (rpcError) {
    // Cofnij app_metadata jeśli DB nie zdążyło zapisać
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { is_super_admin: false } })
    console.error('Error completing super admin setup:', rpcError.message)
    return { success: false, error: rpcError.message }
  }

  const supabase = await createClient()
  await supabase.auth.refreshSession()

  redirect('/super-admin')
}

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteSuperAdmin(
  _prevState: SuperAdminActionState,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await requireSuperAdmin()

  const parsed = InviteSchema.safeParse({
    email: formData.get('email') ?? '',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { email } = parsed.data
  const admin = createAdminClient()

  const { data: invite, error: insertError } = await admin
    .from('super_admin_invites')
    .insert({ email, invited_by: user.id })
    .select('id, token')
    .single()

  if (insertError || !invite) {
    console.error('Error creating invite:', insertError)
    return { success: false, error: 'Błąd tworzenia zaproszenia.' }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const inviteUrl = `${protocol}://${host}/super-admin/join?token=${invite.token}`

  try {
    await sendSuperAdminInviteEmail({ to: email, url: inviteUrl })
  } catch (error) {
    console.error('Error sending invite email:', error)
    return { success: false, error: 'Zaproszenie zapisane, ale nie udało się wysłać emaila.' }
  }

  await logAudit({
    action: 'super_admin_invited',
    table: 'super_admin_invites',
    rowId: invite.id ?? invite.token,
    changedBy: user.id,
    newData: { email, invited_by: user.id },
  })

  updateTag('super-admins')
  return { success: true }
}

// ── Accept invite ─────────────────────────────────────────────────────────────

export async function acceptSuperAdminInvite(
  _prevState: SuperAdminActionState,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await getCurrentUser()

  const parsed = AcceptInviteSchema.safeParse({
    token: formData.get('token') ?? '',
    full_name: formData.get('full_name') ?? '',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { token, full_name } = parsed.data
  const admin = createAdminClient()

  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { is_super_admin: true },
    user_metadata: { full_name },
  })

  if (metaError) {
    console.error('Error setting app_metadata:', metaError)
    return { success: false, error: 'Błąd ustawiania uprawnień.' }
  }

  // Atomowa transakcja: walidacja + blokada invite (FOR UPDATE) + profil + super_admin + audit log
  const { error: rpcError } = await admin.rpc('accept_super_admin_invite', {
    p_token: token,
    p_user_id: user.id,
    p_email: user.email ?? '',
    p_full_name: full_name,
  })

  if (rpcError) {
    // Cofnij app_metadata jeśli DB nie zdążyło zapisać
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { is_super_admin: false } })
    console.error('Error accepting super admin invite:', rpcError.message)
    return { success: false, error: rpcError.message }
  }

  const supabase = await createClient()
  await supabase.auth.refreshSession()

  redirect('/super-admin')
}
