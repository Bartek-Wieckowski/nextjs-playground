import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── helpers ──────────────────────────────────────────────────────────────

  function isSuperAdmin(email: string | undefined): boolean {
    if (!email) return false;
    const allowed = (process.env.SUPER_ADMIN_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowed.includes(email.toLowerCase());
  }

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ── /admin/* – tylko super admin ─────────────────────────────────────────

  if (pathname.startsWith("/admin")) {
    if (!user) return redirectTo("/login");
    if (!isSuperAdmin(user.email)) return redirectTo("/dashboard");
    return supabaseResponse;
  }

  // ── /dashboard – tylko zalogowani ────────────────────────────────────────

  if (pathname.startsWith("/dashboard")) {
    if (!user) return redirectTo("/login");
    return supabaseResponse;
  }

  // ── /login – jeśli zalogowany, przekieruj dalej ──────────────────────────

  if (pathname === "/login") {
    if (user) {
      return redirectTo(isSuperAdmin(user.email) ? "/admin" : "/dashboard");
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
