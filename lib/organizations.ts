import slugify from "slugify";
import { createClient } from "@/lib/supabase/server";
import type {
  Organization,
  OrganizationMember,
  OrganizationRole,
  Profile,
} from "@/lib/types";

// ============================================
// ORGANIZATION FUNCTIONS
// ============================================

/**
 * Pobierz organizacje zalogowanego użytkownika
 */
export async function getOrganizations(): Promise<Organization[]> {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(*)")
    .eq("user_id", user.id);

  if (error) {
    console.error("Error fetching organizations:", error);
    return [];
  }

  return data
    .map(
      (item: unknown) =>
        (item as { organizations: Organization | null }).organizations,
    )
    .filter(Boolean) as Organization[];
}

/**
 * Pobierz pojedynczą organizację
 */
export async function getOrganization(
  organizationId: string,
): Promise<Organization | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (error) {
    console.error("Error fetching organization:", error);
    return null;
  }

  return data as Organization;
}

/**
 * Zaktualizuj organizację (tylko admin organizacji)
 */
export async function updateOrganization(
  organizationId: string,
  updates: Partial<Pick<Organization, "name" | "slug" | "description">>,
): Promise<Organization> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", organizationId)
    .select()
    .single();

  if (error) throw error;
  return data as Organization;
}

// ============================================
// ORGANIZATION MEMBERS FUNCTIONS
// ============================================

/**
 * Pobierz członków organizacji wraz z profilami
 */
export async function getOrganizationMembers(
  organizationId: string,
): Promise<(OrganizationMember & { profiles: Profile })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      *,
      profiles(*)
    `,
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching members:", error);
    return [];
  }

  return data as (OrganizationMember & { profiles: Profile })[];
}

/**
 * Pobierz rolę zalogowanego użytkownika w organizacji
 */
export async function getUserOrganizationRole(
  organizationId: string,
): Promise<OrganizationRole | null> {
  const supabase = await createClient();

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data.role as OrganizationRole;
}

// ============================================
// HELPERS
// ============================================

/**
 * Generuj slug z nazwy organizacji
 */
export function generateSlug(name: string): string {
  return slugify(name, { lower: true, strict: true });
}

/**
 * Sprawdź czy zalogowany użytkownik jest adminem organizacji
 */
export async function isOrgAdmin(organizationId: string): Promise<boolean> {
  const role = await getUserOrganizationRole(organizationId);
  return role === "admin";
}
