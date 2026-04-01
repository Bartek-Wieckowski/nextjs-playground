import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── helpers ──────────────────────────────────────────────────────────────

  // Sprawdza JWT app_metadata — ustawiane wyłącznie przez service role,
  // weryfikowane po stronie serwera Supabase przez getUser() (nie getSession()).
  function isSuperAdmin(u: User | null): boolean {
    return u?.app_metadata?.is_super_admin === true
  }

  function redirectTo(path: string) {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Redirect do /login z zachowaniem oryginalnej ścieżki jako ?next=
  // Po zalogowaniu auth/callback przekieruje z powrotem.
  function redirectToLogin() {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(next)}`
    return NextResponse.redirect(url, 302)
  }

  // ── /super-admin/setup i /super-admin/join ────────────────────────────────
  // Dostępne dla zalogowanych (strona sama sprawdza token/invite).
  // NIE wymagają bycia super adminem — to flow tworzenia super admina.

  if (
    pathname.startsWith('/super-admin/setup') ||
    pathname.startsWith('/super-admin/join')
  ) {
    if (!user) return redirectToLogin()
    return supabaseResponse
  }

  // ── /super-admin/* – tylko super admin ───────────────────────────────────

  if (pathname.startsWith('/super-admin')) {
    if (!user) return redirectToLogin()
    if (!isSuperAdmin(user)) return redirectTo('/dashboard')
    return supabaseResponse
  }

  // ── /dashboard – tylko zalogowani, ze sprawdzeniem statusu org ──────────

  if (pathname.startsWith('/dashboard')) {
    if (!user) return redirectToLogin()

    // Super admin nie należy do żadnej org — pomijamy sprawdzenie
    if (!isSuperAdmin(user)) {
      // Admin client omija RLS — jedyny sposób odczytać status cancelled/suspended org
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )

      const { data: membership } = await adminClient
        .from('organization_members')
        .select('organizations(status, deleted_at)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      const org = Array.isArray(membership?.organizations)
        ? membership.organizations[0]
        : membership?.organizations

      if (!org || org.deleted_at !== null || org.status === 'cancelled') {
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = '?reason=org_cancelled'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  }

  // ── /login – jeśli zalogowany, przekieruj dalej ──────────────────────────

  if (pathname === '/login') {
    if (user) {
      return redirectTo(isSuperAdmin(user) ? '/super-admin' : '/dashboard')
    }
    return supabaseResponse
  }

  return supabaseResponse
}
