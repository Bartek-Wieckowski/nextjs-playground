// Database types
export type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type SuperAdmin = {
  id: string
  position: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Organization = {
  id: string
  name: string
  slug: string
  industry: string | null
  company_size: string | null
  website: string | null
  logo_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'

export type OrganizationMember = {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

export type InvitationType = 'organization_owner' | 'organization_member' | 'super_admin'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'

export type Invitation = {
  id: string
  token: string
  invitation_type: InvitationType
  status: InvitationStatus
  email: string
  organization_id: string | null
  role: OrganizationRole | null
  invited_by: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

// Extended types with relations
export type OrganizationWithMembers = Organization & {
  organization_members: OrganizationMember[]
}

export type OrganizationMemberWithProfile = OrganizationMember & {
  profiles: Profile
}

export type InvitationWithOrganization = Invitation & {
  organizations?: Organization
  invited_by_profile?: Profile
}
