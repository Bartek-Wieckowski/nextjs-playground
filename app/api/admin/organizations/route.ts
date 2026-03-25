import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdmin, createOrganization, createInvitation } from '@/lib/organizations'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Sprawdź czy użytkownik jest super adminem
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, slug, ownerEmail, sendInvite } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Sprawdź czy slug jest unikalny
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      )
    }

    // Jeśli wysyłamy invite, sprawdź czy user już istnieje
    let ownerId = user.id // Domyślnie super admin jako owner
    
    if (sendInvite && ownerEmail) {
      // Sprawdź czy użytkownik o takim emailu istnieje
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', ownerEmail)
        .single()

      if (existingUser) {
        ownerId = existingUser.id
      }
      
      // Utwórz organizację (tymczasowo z super adminem jako owner)
      const organization = await createOrganization(name, slug, user.id)

      // Wyślij zaproszenie dla właściciela
      const invitation = await createInvitation(
        ownerEmail,
        'organization_owner',
        {
          organizationId: organization.id,
          role: 'owner'
        }
      )

      return NextResponse.json({
        organization,
        invitation,
        message: 'Organization created and invitation sent'
      })
    } else {
      // Utwórz organizację bez wysyłania invite
      const organization = await createOrganization(name, slug, ownerId)

      return NextResponse.json({
        organization,
        message: 'Organization created successfully'
      })
    }
  } catch (error: any) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
