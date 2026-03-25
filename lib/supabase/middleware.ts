import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Obsługa super admin register - ustaw cookie jeśli secret jest poprawny
  if (pathname === '/admin/register') {
    const secretFromUrl = request.nextUrl.searchParams.get('secret')
    const secretFromCookie = request.cookies.get('super_admin_access')?.value
    const expectedSecret = process.env.SUPER_ADMIN_SECRET

    // Jeśli secret w URL jest poprawny, ustaw cookie i przekieruj bez secret w URL
    if (secretFromUrl === expectedSecret) {
      const response = NextResponse.redirect(new URL('/admin/register', request.url))
      response.cookies.set('super_admin_access', secretFromUrl, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 godzina
      })
      return response
    }

    // Jeśli nie ma żadnego poprawnego secretu, przekieruj do home
    if (!secretFromCookie && secretFromUrl !== expectedSecret) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Jeśli cookie nie jest poprawny, przekieruj do home
    if (secretFromCookie !== expectedSecret) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Admin routes - tylko dla super adminów
  if (pathname.startsWith('/admin') && pathname !== '/admin/register') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // Sprawdź czy user jest super adminem (używamy RPC żeby ominąć RLS)
    const { data: isSuperAdmin } = await supabase.rpc('check_is_super_admin', { 
      user_id: user.id 
    })

    if (!isSuperAdmin) {
      // Nie jest super adminem, przekieruj do zwykłego dashboardu
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Protected routes dla zwykłych użytkowników
  const protectedPaths = ['/dashboard', '/organizations']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Jeśli zalogowany próbuje wejść na login/signup
  if (user && ['/login', '/signup'].includes(pathname)) {
    // Sprawdź czy to super admin (używamy RPC)
    const { data: isSuperAdmin } = await supabase.rpc('check_is_super_admin', {
      user_id: user.id
    })

    const url = request.nextUrl.clone()
    url.pathname = isSuperAdmin ? '/admin/dashboard' : '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
