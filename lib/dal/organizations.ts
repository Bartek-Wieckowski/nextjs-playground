import { createAdminClient } from '@/lib/supabase/admin'
import { cacheTag } from 'next/cache'
import type { Organization, OrganizationMember } from '@/lib/types'

// ── User-facing ───────────────────────────────────────────────────────────────

/**
 * Organizacje zalogowanego użytkownika.
 * Cached per-user — invalidate with revalidateTag('organizations').
 */
export async function getOrganizationsForUser(userId: string) {
  'use cache'
  cacheTag('organizations', `user-orgs:${userId}`)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organization_members')
    .select('role, status, organizations(*)')
    .eq('user_id', userId)

  if (error) {
    console.error('getOrganizationsForUser error:', error)
    return []
  }

  return (data ?? [])
    .map((m) => ({
      membership: {
        role: m.role as OrganizationMember['role'],
        status: m.status as OrganizationMember['status'],
      },
      org: (Array.isArray(m.organizations) ? m.organizations[0] : m.organizations) as Organization | null,
    }))
    .filter((m): m is { membership: typeof m.membership; org: Organization } =>
      m.org !== null && m.org.deleted_at === null,
    )
}

/**
 * Członkowie organizacji z profilami.
 * Cached per-org — invalidate with revalidateTag(`org-members:${orgId}`).
 */
export async function getOrganizationMembers(orgId: string) {
  'use cache'
  cacheTag('org-members', `org-members:${orgId}`)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organization_members')
    .select('*, profiles(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getOrganizationMembers error:', error)
    return []
  }

  return data ?? []
}

// ── Super Admin ───────────────────────────────────────────────────────────────

/**
 * Wszystkie aktywne (niusunięte) organizacje.
 * Cached globally — invalidate with revalidateTag('organizations').
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  'use cache'
  cacheTag('organizations')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organizations')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getAllOrganizations error:', error)
    return []
  }

  return (data ?? []) as Organization[]
}

/**
 * Usunięte organizacje (kosz).
 * Cached globally — invalidate with revalidateTag('organizations').
 */
export async function getDeletedOrganizations(): Promise<Organization[]> {
  'use cache'
  cacheTag('organizations', 'deleted-organizations')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organizations')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    console.error('getDeletedOrganizations error:', error)
    return []
  }

  return (data ?? []) as Organization[]
}
