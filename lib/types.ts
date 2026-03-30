// ============================================
// DATABASE TYPES
// ============================================

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
};

export type OrganizationRole = "admin" | "member";

export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
};

export type OrganizationRequestStatus = "pending" | "approved" | "rejected";

export type OrganizationRequest = {
  id: string;
  full_name: string;
  email: string;
  organization_name: string;
  description: string | null;
  token: string;
  status: OrganizationRequestStatus;
  created_at: string;
  approved_at: string | null;
};

// ============================================
// EXTENDED TYPES WITH RELATIONS
// ============================================

export type OrganizationMemberWithProfile = OrganizationMember & {
  profiles: Profile;
};

export type OrganizationWithMembers = Organization & {
  organization_members: OrganizationMember[];
};
