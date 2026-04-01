import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrganizationsForUser, getOrganizationMembers } from '@/lib/dal/organizations'
import { DashboardTabs } from '@/app/dashboard/components/dashboard-tabs'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (user.app_metadata?.is_super_admin === true) {
    redirect('/super-admin')
  }

  const orgs = await getOrganizationsForUser(user.id)

  const adminOrgs = orgs.filter(
    (m) => m.membership.role === 'admin' && m.membership.status === 'active',
  )

  const adminOrgMembers = await Promise.all(
    adminOrgs.map(async ({ org }) => ({
      org,
      members: await getOrganizationMembers(org.id),
    })),
  )

  return (
    <DashboardTabs
      userEmail={user.email ?? ''}
      orgs={orgs}
      adminOrgMembers={adminOrgMembers}
    />
  )
}
