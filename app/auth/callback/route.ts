import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    const safePath = next.startsWith("/") ? next : "/dashboard";
    return NextResponse.redirect(`${origin}${safePath}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.exchangeCodeForSession(code);

  // Super admin nie jest przypisany do żadnej org — przepuszczamy
  if (user && user.app_metadata?.is_super_admin !== true) {
    const adminClient = createAdminClient(
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
      return NextResponse.redirect(`${origin}/login?reason=org_cancelled`)
    }
  }

  const safePath = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${safePath}`);
}
