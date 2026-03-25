-- ============================================
-- FIX: Infinite recursion in super_admins RLS policies
-- ============================================
-- Problem: Policies were checking super_admins table directly,
-- causing infinite recursion. Solution: Use SECURITY DEFINER function
-- that bypasses RLS.

-- ============================================
-- STEP 1: Create all helper functions first
-- ============================================

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION check_is_super_admin(user_id UUID)
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins 
    WHERE id = user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if user has role in organization
CREATE OR REPLACE FUNCTION check_user_org_role(user_id UUID, org_id UUID, required_roles organization_role[])
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_members.user_id = user_id 
    AND organization_members.organization_id = org_id
    AND organization_members.role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if user is member of organization
CREATE OR REPLACE FUNCTION check_user_in_org(user_id UUID, org_id UUID)
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_members.user_id = user_id 
    AND organization_members.organization_id = org_id
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to get user email (bypasses auth.users permission issues)
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2: Recreate all RLS policies using helper functions
-- ============================================

-- --------------------------------------------
-- SUPER ADMINS POLICIES
-- --------------------------------------------

DROP POLICY IF EXISTS "Super admins can view super admins" ON super_admins;
DROP POLICY IF EXISTS "Super admins can update super admins" ON super_admins;

CREATE POLICY "Super admins can view super admins"
  ON super_admins FOR SELECT
  USING (check_is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update super admins"
  ON super_admins FOR UPDATE
  USING (check_is_super_admin(auth.uid()));

-- --------------------------------------------
-- ORGANIZATIONS POLICIES
-- --------------------------------------------

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    check_is_super_admin(auth.uid())
    OR
    check_user_in_org(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Super admins and invited users can create organizations" ON organizations;
CREATE POLICY "Super admins and invited users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    check_is_super_admin(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.email = get_user_email(auth.uid())
      AND invitations.invitation_type = 'organization_owner'
      AND invitations.status = 'pending'
      AND invitations.expires_at > NOW()
    )
  );

DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    check_is_super_admin(auth.uid())
    OR
    check_user_org_role(auth.uid(), id, ARRAY['owner', 'admin']::organization_role[])
  );

DROP POLICY IF EXISTS "Super admins and owners can delete organizations" ON organizations;
CREATE POLICY "Super admins and owners can delete organizations"
  ON organizations FOR DELETE
  USING (
    check_is_super_admin(auth.uid())
    OR
    check_user_org_role(auth.uid(), id, ARRAY['owner']::organization_role[])
  );

-- --------------------------------------------
-- ORGANIZATION MEMBERS POLICIES
-- --------------------------------------------

DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  USING (
    check_is_super_admin(auth.uid())
    OR
    check_user_in_org(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Admins can add members" ON organization_members;
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (
    check_is_super_admin(auth.uid())
    OR
    check_user_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::organization_role[])
  );

DROP POLICY IF EXISTS "Admins can update member roles" ON organization_members;
CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  USING (
    check_is_super_admin(auth.uid())
    OR
    check_user_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::organization_role[])
  );

DROP POLICY IF EXISTS "Admins can remove members" ON organization_members;
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  USING (
    check_is_super_admin(auth.uid())
    OR
    user_id = auth.uid()
    OR
    check_user_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::organization_role[])
  );

-- --------------------------------------------
-- INVITATIONS POLICIES
-- --------------------------------------------

DROP POLICY IF EXISTS "Users can view relevant invitations" ON invitations;
CREATE POLICY "Users can view relevant invitations"
  ON invitations FOR SELECT
  USING (
    check_is_super_admin(auth.uid())
    OR
    invitations.email = get_user_email(auth.uid())
    OR
    (
      invitations.organization_id IS NOT NULL 
      AND check_user_org_role(auth.uid(), invitations.organization_id, ARRAY['owner', 'admin']::organization_role[])
    )
  );

DROP POLICY IF EXISTS "Authorized users can create invitations" ON invitations;
CREATE POLICY "Authorized users can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    check_is_super_admin(auth.uid())
    OR
    (
      invitation_type IN ('organization_member', 'organization_owner')
      AND invitations.organization_id IS NOT NULL
      AND check_user_org_role(auth.uid(), invitations.organization_id, ARRAY['owner', 'admin']::organization_role[])
    )
  );

DROP POLICY IF EXISTS "Users can update their invitations" ON invitations;
CREATE POLICY "Users can update their invitations"
  ON invitations FOR UPDATE
  USING (
    check_is_super_admin(auth.uid())
    OR
    invitations.invited_by = auth.uid()
  );
