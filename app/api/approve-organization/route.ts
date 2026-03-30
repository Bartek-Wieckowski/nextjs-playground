import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email";
import { generateSlug } from "@/lib/organizations";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/?error=missing_token`);
  }

  const admin = createAdminClient();

  // Pobierz wniosek po tokenie
  const { data: orgRequest, error: fetchError } = await admin
    .from("organization_requests")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (fetchError || !orgRequest) {
    return NextResponse.redirect(`${origin}/?error=invalid_token`);
  }

  try {
    // 1. Generuj unikalny slug
    let slug = generateSlug(orgRequest.organization_name);

    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // 2. Utwórz organizację
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: orgRequest.organization_name,
        slug,
        description: orgRequest.description,
        status: "active",
      })
      .select()
      .single();

    if (orgError)
      throw new Error(`Błąd tworzenia organizacji: ${orgError.message}`);

    // 3. Utwórz użytkownika w auth.users (lub znajdź istniejącego)
    let userId: string;

    const { data: newUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: orgRequest.email,
        email_confirm: true,
        user_metadata: {
          full_name: orgRequest.full_name,
        },
      });

    if (createUserError) {
      // Użytkownik może już istnieć — szukamy po emailu w profiles
      const { data: existingProfile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("email", orgRequest.email)
        .single();

      if (profileError || !existingProfile) {
        throw new Error(
          `Nie można utworzyć ani znaleźć użytkownika: ${createUserError.message}`,
        );
      }

      userId = existingProfile.id;
    } else {
      userId = newUser.user.id;
    }

    // 4. Dodaj użytkownika do organizacji jako admin
    const { error: memberError } = await admin
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: "admin",
      });

    if (memberError)
      throw new Error(`Błąd dodawania członka: ${memberError.message}`);

    // 5. Generuj magic link do pierwszego logowania
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: orgRequest.email,
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      throw new Error(`Błąd generowania magic linku: ${linkError?.message}`);
    }

    const magicLink = linkData.properties.action_link;

    // 6. Wyślij email powitalny z magic linkiem
    await sendWelcomeEmail({
      fullName: orgRequest.full_name,
      email: orgRequest.email,
      organizationName: orgRequest.organization_name,
      magicLink,
    });

    // 7. Oznacz wniosek jako zatwierdzony
    await admin
      .from("organization_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("token", token);

    return NextResponse.redirect(`${origin}/approve-success`);
  } catch (error: unknown) {
    console.error(
      "Error approving organization:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.redirect(`${origin}/?error=approval_failed`);
  }
}
