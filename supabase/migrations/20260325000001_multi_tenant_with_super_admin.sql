-- ============================================
-- MULTI-TENANT SCHEMA Z SUPER ADMIN
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES - Podstawowe info o każdym użytkowniku
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SUPER ADMINS - Pracownicy CompanyTheBest
-- ============================================
CREATE TABLE super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  position TEXT, -- np. "CEO", "CTO", "Support Manager"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ORGANIZATIONS - Organizacje klientów
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  -- Opcjonalne dodatkowe pola:
  industry TEXT,
  company_size TEXT,
  website TEXT,
  logo_url TEXT,
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ORGANIZATION MEMBERS - Użytkownicy w organizacjach
-- ============================================
CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role organization_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ============================================
-- 5. INVITATIONS - System zaproszeń
-- ============================================
CREATE TYPE invitation_type AS ENUM ('organization_owner', 'organization_member', 'super_admin');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invitation_type invitation_type NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  
  -- Dla kogo
  email TEXT NOT NULL,
  
  -- Kontekst zaproszenia
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role organization_role, -- Dla organization_member/owner
  
  -- Kto zaprosił
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Metadata
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_org_invitation CHECK (
    (invitation_type IN ('organization_owner', 'organization_member') AND organization_id IS NOT NULL)
    OR (invitation_type = 'super_admin' AND organization_id IS NULL)
  )
);

-- ============================================
-- INDEXES dla wydajności
-- ============================================
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_status ON invitations(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- PROFILES POLICIES
-- --------------------------------------------

-- Wszyscy authenticated mogą widzieć profile (potrzebne dla list członków)
CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Użytkownik może edytować swój profil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Użytkownik może stworzyć swój profil
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- --------------------------------------------
-- SUPER ADMINS POLICIES
-- --------------------------------------------

-- Super admini widzą innych super adminów
CREATE POLICY "Super admins can view super admins"
  ON super_admins FOR SELECT
  USING (
    -- Sprawdź bezpośrednio w tabeli czy current user jest super adminem
    auth.uid() IN (SELECT id FROM super_admins WHERE is_active = true)
  );

-- Inserting super admin - tylko authenticated users mogą dodawać
-- (będzie kontrolowane przez application logic)
CREATE POLICY "Authenticated users can insert super admins"
  ON super_admins FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Tylko super admini mogą aktualizować
CREATE POLICY "Super admins can update super admins"
  ON super_admins FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM super_admins WHERE is_active = true)
  );

-- --------------------------------------------
-- ORGANIZATIONS POLICIES
-- --------------------------------------------

-- Super admini widzą wszystkie organizacje
-- Członkowie widzą tylko swoje organizacje
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    -- Super admin widzi wszystko
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    -- Członek widzi swoją organizację
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Super admini i ownerzy mogą tworzyć organizacje
CREATE POLICY "Super admins and invited users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    -- Super admin może tworzyć
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    -- Lub użytkownik z ważnym invitation typu organization_owner
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND invitations.invitation_type = 'organization_owner'
      AND invitations.status = 'pending'
      AND invitations.expires_at > NOW()
    )
  );

-- Super admini i ownerzy/admini mogą edytować organizacje
CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Tylko super admini i ownerzy mogą usuwać organizacje
CREATE POLICY "Super admins and owners can delete organizations"
  ON organizations FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
    )
  );

-- --------------------------------------------
-- ORGANIZATION MEMBERS POLICIES
-- --------------------------------------------

-- Super admini widzą wszystkich członków
-- Członkowie widzą tylko członków swojej organizacji
CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Super admini, ownerzy i admini mogą dodawać członków
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Super admini, ownerzy i admini mogą zmieniać role
CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Super admini, ownerzy, admini mogą usuwać członków
-- Członkowie mogą opuścić organizację sami
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    organization_members.user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- --------------------------------------------
-- INVITATIONS POLICIES
-- --------------------------------------------

-- Super admini widzą wszystkie invitations
-- Ownerzy/admini widzą invitations dla swojej organizacji
CREATE POLICY "Users can view relevant invitations"
  ON invitations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    invitations.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Super admini mogą tworzyć wszystkie typy invitations
-- Ownerzy/admini mogą zapraszać do swojej organizacji
CREATE POLICY "Authorized users can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    (
      invitation_type IN ('organization_member', 'organization_owner')
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = invitations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      )
    )
  );

-- Można anulować invitation jeśli się ją utworzyło
CREATE POLICY "Users can update their invitations"
  ON invitations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE id = auth.uid() AND is_active = true)
    OR
    invitations.invited_by = auth.uid()
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Automatycznie twórz profil dla nowego użytkownika
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Uruchom po utworzeniu użytkownika
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers dla updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_super_admins_updated_at BEFORE UPDATE ON super_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Sprawdź czy użytkownik jest super adminem (SECURITY DEFINER - omija RLS)
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

-- Sprawdź rolę użytkownika w organizacji
CREATE OR REPLACE FUNCTION get_user_org_role(user_id UUID, org_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role::TEXT INTO user_role
  FROM organization_members
  WHERE organization_members.user_id = user_id
  AND organization_members.organization_id = org_id;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
