import { createClient } from '@/lib/supabase/server'
import type {
  Organization,
  OrganizationMember,
  OrganizationRole,
  Profile,
  SuperAdmin,
  Invitation,
  InvitationType,
} from '@/lib/types'

// ============================================
// SUPER ADMIN FUNCTIONS
// ============================================

/**
 * Sprawdź czy użytkownik jest super adminem
 */
export async function isSuperAdmin(userId?: string): Promise<boolean> {
  const supabase = await createClient()
  
  const uid = userId || (await supabase.auth.getUser()).data.user?.id
  if (!uid) return false

  // Używamy service role client żeby ominąć RLS
  const { data } = await supabase.rpc('check_is_super_admin', { user_id: uid })
  
  return data === true
}

/**
 * Pobierz dane super admina
 */
export async function getSuperAdmin(userId: string): Promise<SuperAdmin | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('super_admins')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data as SuperAdmin
}

/**
 * Stwórz super admina (wywoływane przy rejestracji z secret token)
 */
export async function createSuperAdmin(
  userId: string,
  position: string
): Promise<SuperAdmin> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('super_admins')
    .insert({
      id: userId,
      position,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as SuperAdmin
}

// ============================================
// ORGANIZATION FUNCTIONS
// ============================================

/**
 * Pobierz wszystkie organizacje (dla super admina) lub organizacje użytkownika
 */
export async function getOrganizations(): Promise<Organization[]> {
  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return []

  const isSuperAdminUser = await isSuperAdmin(user.id)

  // Jeśli jest super adminem, pokaż wszystkie organizacje
  if (isSuperAdminUser) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching organizations:', error)
      return []
    }

    return data as Organization[]
  }

  // Jeśli nie jest super adminem, pobierz tylko jego organizacje
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(*)')
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching organizations:', error)
    return []
  }

  // Wyciągnij organizacje z relacji
  const organizations = data
    .map((item: any) => item.organizations)
    .filter(Boolean)

  return organizations as Organization[]
}

/**
 * Pobierz pojedynczą organizację
 */
export async function getOrganization(organizationId: string): Promise<Organization | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single()

  if (error) {
    console.error('Error fetching organization:', error)
    return null
  }

  return data as Organization
}

/**
 * Stwórz nową organizację
 */
export async function createOrganization(
  name: string,
  slug: string,
  ownerId: string,
  additionalData?: {
    industry?: string
    company_size?: string
    website?: string
  }
): Promise<Organization> {
  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Not authenticated')

  // Stwórz organizację
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      created_by: user.id,
      ...additionalData,
    })
    .select()
    .single()

  if (orgError) throw orgError

  // Dodaj ownera jako członka
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: ownerId,
      role: 'owner',
      invited_by: user.id,
    })

  if (memberError) throw memberError

  return org as Organization
}

/**
 * Zaktualizuj organizację
 */
export async function updateOrganization(
  organizationId: string,
  updates: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>
): Promise<Organization> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', organizationId)
    .select()
    .single()

  if (error) throw error
  return data as Organization
}

/**
 * Usuń organizację
 */
export async function deleteOrganization(organizationId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', organizationId)

  if (error) throw error
}

// ============================================
// ORGANIZATION MEMBERS FUNCTIONS
// ============================================

/**
 * Pobierz członków organizacji
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<(OrganizationMember & { profiles: Profile })[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      *,
      profiles(*)
    `)
    .eq('organization_id', organizationId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Error fetching members:', error)
    return []
  }

  return data as (OrganizationMember & { profiles: Profile })[]
}

/**
 * Pobierz rolę użytkownika w organizacji
 */
export async function getUserOrganizationRole(
  organizationId: string,
  userId?: string
): Promise<OrganizationRole | null> {
  const supabase = await createClient()
  
  const uid = userId || (await supabase.auth.getUser()).data.user?.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', uid)
    .single()

  if (error) return null
  return data.role as OrganizationRole
}

/**
 * Dodaj członka do organizacji
 */
export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: OrganizationRole = 'member'
): Promise<OrganizationMember> {
  const supabase = await createClient()
  const currentUser = (await supabase.auth.getUser()).data.user
  if (!currentUser) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      invited_by: currentUser.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as OrganizationMember
}

/**
 * Zaktualizuj rolę członka
 */
export async function updateMemberRole(
  membershipId: string,
  role: OrganizationRole
): Promise<OrganizationMember> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', membershipId)
    .select()
    .single()

  if (error) throw error
  return data as OrganizationMember
}

/**
 * Usuń członka z organizacji
 */
export async function removeMember(membershipId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', membershipId)

  if (error) throw error
}

// ============================================
// INVITATIONS FUNCTIONS
// ============================================

/**
 * Stwórz zaproszenie
 */
export async function createInvitation(
  email: string,
  invitationType: InvitationType,
  options: {
    organizationId?: string
    role?: OrganizationRole
  } = {}
): Promise<Invitation> {
  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      email,
      invitation_type: invitationType,
      organization_id: options.organizationId,
      role: options.role,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as Invitation
}

/**
 * Pobierz zaproszenie po tokenie
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invitations')
    .select(`
      *,
      organizations(*),
      invited_by_profile:profiles!invitations_invited_by_fkey(*)
    `)
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error) return null
  return data as Invitation
}

/**
 * Zaakceptuj zaproszenie
 */
export async function acceptInvitation(token: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('token', token)

  if (error) throw error
}

/**
 * Anuluj zaproszenie
 */
export async function cancelInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)

  if (error) throw error
}

/**
 * Pobierz zaproszenia dla organizacji
 */
export async function getOrganizationInvitations(
  organizationId: string
): Promise<Invitation[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching invitations:', error)
    return []
  }

  return data as Invitation[]
}
