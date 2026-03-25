import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getInvitationByToken,
  acceptInvitation,
  addOrganizationMember,
  createSuperAdmin,
} from '@/lib/organizations'

export default async function ProcessInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token

  if (!token) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/invite/accept?token=${token}`)
  }

  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    redirect('/')
  }

  try {
    // Akceptuj zaproszenie
    await acceptInvitation(token, user.id)

    // Obsłuż różne typy zaproszeń
    if (invitation.invitation_type === 'super_admin') {
      // Dodaj jako super admina
      await createSuperAdmin(user.id, user.user_metadata?.position || 'Admin')
      redirect('/admin/dashboard')
    } else if (invitation.invitation_type === 'organization_owner') {
      // Dodaj jako owner organizacji
      if (invitation.organization_id) {
        await addOrganizationMember(invitation.organization_id, user.id, 'owner')
        redirect(`/organizations/${invitation.organization_id}`)
      }
    } else if (invitation.invitation_type === 'organization_member') {
      // Dodaj jako członek organizacji
      if (invitation.organization_id && invitation.role) {
        await addOrganizationMember(invitation.organization_id, user.id, invitation.role)
        redirect(`/organizations/${invitation.organization_id}`)
      }
    }

    redirect('/dashboard')
  } catch (error) {
    console.error('Error processing invitation:', error)
    redirect('/')
  }
}
