'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { UpdateMemberStatusSchema, RemoveMemberSchema, AddMemberSchema, UpdateMemberSchema } from '@/lib/schemas/member'
import { sendMemberInviteEmail } from '@/lib/email'

export type MemberActionState = {
  success: boolean
  error?: string
}

async function requireOrgAdmin(orgId: string) {
  const user = await getCurrentUser()
  const admin = createAdminClient()

  const { data: member } = await admin
    .from('organization_members')
    .select('role, organizations(status)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle()

  if (!member) throw new Error('Forbidden')

  const org = Array.isArray(member.organizations) ? member.organizations[0] : member.organizations
  if (org?.status === 'cancelled') throw new Error('OrgCancelled')
  if (org?.status === 'suspended') throw new Error('OrgSuspended')

  return user
}

export async function updateMemberStatus(
  memberId: string,
  orgId: string,
  status: 'active' | 'suspended',
): Promise<MemberActionState> {
  const parsed = UpdateMemberStatusSchema.safeParse({ memberId, orgId, status })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  let currentUser: Awaited<ReturnType<typeof requireOrgAdmin>>
  try {
    currentUser = await requireOrgAdmin(orgId)
  } catch (e) {
    if (e instanceof Error && e.message === 'OrgSuspended')
      return { success: false, error: 'Organizacja jest zawieszona.' }
    if (e instanceof Error && e.message === 'OrgCancelled')
      return { success: false, error: 'Organizacja została anulowana.' }
    return { success: false, error: 'Brak uprawnień.' }
  }

  const admin = createAdminClient()

  const { data: current } = await admin
    .from('organization_members')
    .select('status')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single()

  const { error } = await admin
    .from('organization_members')
    .update({ status })
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Error updating member status:', error)
    return { success: false, error: 'Błąd aktualizacji statusu.' }
  }

  await logAudit({
    action: 'member_status_changed',
    table: 'organization_members',
    rowId: memberId,
    changedBy: currentUser.id,
    oldData: current ? { status: current.status } : undefined,
    newData: { status },
  })

  updateTag(`org-members:${orgId}`)
  updateTag(`audit:${memberId}`)
  return { success: true }
}

export async function removeMember(
  memberId: string,
  orgId: string,
): Promise<MemberActionState> {
  const parsed = RemoveMemberSchema.safeParse({ memberId, orgId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  let currentUser: Awaited<ReturnType<typeof requireOrgAdmin>>
  try {
    currentUser = await requireOrgAdmin(orgId)
  } catch (e) {
    if (e instanceof Error && e.message === 'OrgSuspended')
      return { success: false, error: 'Organizacja jest zawieszona.' }
    if (e instanceof Error && e.message === 'OrgCancelled')
      return { success: false, error: 'Organizacja została anulowana.' }
    return { success: false, error: 'Brak uprawnień.' }
  }

  const admin = createAdminClient()

  const { data: current } = await admin
    .from('organization_members')
    .select('user_id, role, status')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single()

  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Error removing member:', error)
    return { success: false, error: 'Błąd usuwania członka.' }
  }

  await logAudit({
    action: 'member_removed',
    table: 'organization_members',
    rowId: memberId,
    changedBy: currentUser.id,
    oldData: current
      ? { user_id: current.user_id, role: current.role, status: current.status }
      : undefined,
  })

  updateTag(`org-members:${orgId}`)
  return { success: true }
}

// ── Add member ────────────────────────────────────────────────────────────────

export async function addMember(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = AddMemberSchema.safeParse({
    orgId: formData.get('orgId') ?? '',
    fullName: formData.get('fullName') ?? '',
    email: formData.get('email') ?? '',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { orgId, fullName, email } = parsed.data

  let currentUser: Awaited<ReturnType<typeof requireOrgAdmin>>
  try {
    currentUser = await requireOrgAdmin(orgId)
  } catch (e) {
    if (e instanceof Error && e.message === 'OrgSuspended')
      return { success: false, error: 'Organizacja jest zawieszona.' }
    if (e instanceof Error && e.message === 'OrgCancelled')
      return { success: false, error: 'Organizacja została anulowana.' }
    return { success: false, error: 'Brak uprawnień.' }
  }

  const admin = createAdminClient()

  // Create user or find existing
  let userId: string
  let userCreatedNow = false

  const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createUserError) {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!existingProfile) {
      return { success: false, error: `Nie można utworzyć użytkownika: ${createUserError.message}` }
    }
    userId = existingProfile.id
  } else {
    userId = newUser.user.id
    userCreatedNow = true
  }

  const { error: rpcError } = await admin.rpc('add_member', {
    p_organization_id: orgId,
    p_user_id: userId,
    p_role: 'member',
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    if (userCreatedNow) await admin.auth.admin.deleteUser(userId)
    if (rpcError.message.includes('AlreadyMember'))
      return { success: false, error: 'Ten użytkownik jest już członkiem tej organizacji.' }
    console.error('Error adding member:', rpcError)
    return { success: false, error: 'Błąd dodawania członka.' }
  }

  // Send magic link email
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const origin = `${protocol}://${host}`

  const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).single()

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (!linkError && linkData?.properties?.action_link) {
    await sendMemberInviteEmail({
      fullName,
      email,
      organizationName: org?.name ?? 'organizacji',
      magicLink: linkData.properties.action_link,
    })
  }

  updateTag(`org-members:${orgId}`)
  return { success: true }
}

// ── Update member ─────────────────────────────────────────────────────────────

export async function updateMember(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const parsed = UpdateMemberSchema.safeParse({
    memberId: formData.get('memberId') ?? '',
    orgId: formData.get('orgId') ?? '',
    fullName: formData.get('fullName') ?? '',
    role: formData.get('role') ?? '',
    status: formData.get('status') ?? '',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { memberId, orgId, fullName, role, status } = parsed.data

  let currentUser: Awaited<ReturnType<typeof requireOrgAdmin>>
  try {
    currentUser = await requireOrgAdmin(orgId)
  } catch (e) {
    if (e instanceof Error && e.message === 'OrgSuspended')
      return { success: false, error: 'Organizacja jest zawieszona.' }
    if (e instanceof Error && e.message === 'OrgCancelled')
      return { success: false, error: 'Organizacja została anulowana.' }
    return { success: false, error: 'Brak uprawnień.' }
  }

  const admin = createAdminClient()

  const { error: rpcError } = await admin.rpc('update_member', {
    p_member_id: memberId,
    p_org_id: orgId,
    p_full_name: fullName,
    p_role: role,
    p_status: status,
    p_changed_by: currentUser.id,
  })

  if (rpcError) {
    if (rpcError.message.includes('NotFound'))
      return { success: false, error: 'Nie znaleziono członka.' }
    console.error('Error updating member:', rpcError)
    return { success: false, error: 'Błąd aktualizacji członka.' }
  }

  updateTag(`org-members:${orgId}`)
  updateTag(`audit:${memberId}`)
  return { success: true }
}

// ── Delete own account ────────────────────────────────────────────────────────

export async function deleteOwnAccount(): Promise<MemberActionState> {
  const user = await getCurrentUser()
  const admin = createAdminClient()

  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('Error deleting account:', error)
    return { success: false, error: 'Błąd usuwania konta.' }
  }

  redirect('/login')
}
