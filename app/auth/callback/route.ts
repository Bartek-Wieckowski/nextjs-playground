import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  console.log('🔍 Auth callback triggered, code:', code ? 'YES' : 'NO')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('🔍 Exchange result:', { 
      hasUser: !!data?.user, 
      error: error?.message,
      userId: data?.user?.id,
      metadata: data?.user?.user_metadata 
    })

    if (!error && data.user) {
      const user = data.user
      
      // Sprawdź czy to rejestracja super admina
      const isSuperAdminRegistration = user.user_metadata?.is_super_admin === true
      
      console.log('🔍 Is super admin registration?', isSuperAdminRegistration)
      console.log('🔍 User metadata:', user.user_metadata)
      
      if (isSuperAdminRegistration) {
        try {
          // Sprawdź czy super admin już istnieje
          const { data: existingSuperAdmin } = await supabase
            .from('super_admins')
            .select('id')
            .eq('id', user.id)
            .single()

          console.log('🔍 Existing super admin?', !!existingSuperAdmin)

          // Jeśli nie istnieje, stwórz
          if (!existingSuperAdmin) {
            console.log('🔍 Creating super admin...')
            const { error: insertError } = await supabase
              .from('super_admins')
              .insert({
                id: user.id,
                position: user.user_metadata.position || 'Admin',
                is_active: true,
              })

            if (insertError) {
              console.error('❌ Error creating super admin:', insertError)
            } else {
              console.log('✅ Super admin created successfully!')
            }
          }
          
          // Przekieruj do panelu super admina
          console.log('🔍 Redirecting to /admin/dashboard')
          return NextResponse.redirect(`${origin}/admin/dashboard`)
        } catch (error) {
          console.error('❌ Error in super admin flow:', error)
          // Jeśli błąd, przekieruj do zwykłego dashboardu
          return NextResponse.redirect(`${origin}/dashboard`)
        }
      }
    }
  }

  // Standardowe przekierowanie
  console.log('🔍 Standard redirect to /dashboard')
  return NextResponse.redirect(`${origin}/dashboard`)
}
