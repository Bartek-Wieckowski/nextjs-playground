import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getInvitationByToken, acceptInvitation, addOrganizationMember } from '@/lib/organizations'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const token = formData.get('token') as string

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const invitation = await getInvitationByToken(token)

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
    }

    const supabase = await createClient()

    // Wyślij magic link na email z invitation
    const { error } = await supabase.auth.signInWithOtp({
      email: invitation.email,
      options: {
        emailRedirectTo: `${request.headers.get('origin')}/invite/process?token=${token}`,
        data: {
          invitation_token: token,
          invitation_type: invitation.invitation_type,
          organization_id: invitation.organization_id,
          role: invitation.role,
        },
      },
    })

    if (error) throw error

    return NextResponse.redirect(
      `${request.headers.get('origin')}/invite/check-email?email=${encodeURIComponent(invitation.email)}`
    )
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
