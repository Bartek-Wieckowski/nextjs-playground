-- ============================================
-- ORGANIZATIONS
-- Rdzeń multi-tenancy: organizacje i ich członkowie.
-- Statusy jako ENUM — Supabase Studio pokazuje dropdown.
-- is_member_of_org / is_admin_of_org sprawdzają status='active'
-- na memberze, więc zawieszony member traci dostęp automatycznie przez RLS.
-- ============================================

CREATE TYPE organization_role AS ENUM ('admin', 'member');
CREATE TYPE org_status        AS ENUM ('active', 'suspended', 'cancelled');
CREATE TYPE member_status     AS ENUM ('active', 'suspended');

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  status      org_status NOT NULL DEFAULT 'active',
  deleted_at  TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            organization_role NOT NULL DEFAULT 'member',
  status          member_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_organizations_slug           ON organizations(slug);
CREATE INDEX idx_organizations_status         ON organizations(status);
CREATE INDEX idx_organization_members_org_id  ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (SECURITY DEFINER — omijają RLS)
-- ============================================

-- Sprawdza czy aktualny user jest aktywnym memberem danej org.
-- Używana w RLS policies — zawieszony member automatycznie traci dostęp.
CREATE OR REPLACE FUNCTION is_member_of_org(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Sprawdza czy aktualny user jest aktywnym adminem danej org.
CREATE OR REPLACE FUNCTION is_admin_of_org(org_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

-- ============================================
-- ORGANIZATIONS POLICIES
-- ============================================

-- User widzi tylko active orgi których jest aktywnym memberem
CREATE POLICY "Members can view active organizations"
  ON organizations FOR SELECT
  USING (is_member_of_org(id) AND status = 'active' AND deleted_at IS NULL);

-- Tylko org admin może edytować organizację
CREATE POLICY "Admins can update organization"
  ON organizations FOR UPDATE
  USING (is_admin_of_org(id));

-- INSERT i DELETE obsługiwane wyłącznie przez service role

-- ============================================
-- ORGANIZATION MEMBERS POLICIES
-- ============================================

CREATE POLICY "Members can view org members"
  ON organization_members FOR SELECT
  USING (is_member_of_org(organization_id));

-- INSERT/UPDATE/DELETE obsługiwane wyłącznie przez service role

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
