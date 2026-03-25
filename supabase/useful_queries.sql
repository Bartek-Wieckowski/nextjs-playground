-- Przydatne zapytania SQL dla multi-tenant SaaS

-- ============================================
-- 1. SPRAWDZANIE DANYCH
-- ============================================

-- Zobacz wszystkich użytkowników
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.full_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- Zobacz wszystkie organizacje z liczbą członków
SELECT 
  o.id,
  o.name,
  o.slug,
  COUNT(om.id) as member_count,
  o.created_at
FROM organizations o
LEFT JOIN organization_members om ON om.organization_id = o.id
GROUP BY o.id
ORDER BY o.created_at DESC;

-- Zobacz członków organizacji z rolami
SELECT 
  o.name as organization,
  p.email,
  p.full_name,
  om.role,
  om.created_at as joined_at
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN profiles p ON p.id = om.user_id
ORDER BY o.name, om.role;

-- ============================================
-- 2. TESTOWANIE RLS (Row Level Security)
-- ============================================

-- Sprawdź polityki RLS dla organizacji
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('organizations', 'organization_members', 'profiles')
ORDER BY tablename, policyname;

-- Przetestuj RLS jako konkretny użytkownik
-- (zmień user_id na realny ID z tabeli auth.users)
BEGIN;
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "USER_ID_TUTAJ"}';

-- Teraz wykonaj zapytanie - zobaczysz tylko dane tego użytkownika
SELECT * FROM organizations;
SELECT * FROM organization_members;

ROLLBACK;

-- ============================================
-- 3. ZARZĄDZANIE DANYMI
-- ============================================

-- Dodaj użytkownika do organizacji (ręcznie)
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  'organization-id-tutaj',
  'user-id-tutaj',
  'member'  -- lub 'admin', 'owner'
);

-- Zmień rolę użytkownika
UPDATE organization_members
SET role = 'admin'
WHERE organization_id = 'organization-id-tutaj'
  AND user_id = 'user-id-tutaj';

-- Usuń użytkownika z organizacji
DELETE FROM organization_members
WHERE organization_id = 'organization-id-tutaj'
  AND user_id = 'user-id-tutaj';

-- Utwórz nową organizację i dodaj użytkownika jako owner
WITH new_org AS (
  INSERT INTO organizations (name, slug)
  VALUES ('Nowa Firma', 'nowa-firma')
  RETURNING id
)
INSERT INTO organization_members (organization_id, user_id, role)
SELECT new_org.id, 'user-id-tutaj', 'owner'
FROM new_org;

-- ============================================
-- 4. DEBUGGING I MONITORING
-- ============================================

-- Zobacz ostatnie logowania użytkowników
SELECT 
  u.email,
  u.last_sign_in_at,
  u.confirmed_at,
  u.email_confirmed_at
FROM auth.users u
ORDER BY u.last_sign_in_at DESC NULLS LAST
LIMIT 10;

-- Sprawdź organizacje bez właścicieli (błąd!)
SELECT 
  o.id,
  o.name,
  o.slug
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 
  FROM organization_members om 
  WHERE om.organization_id = o.id 
    AND om.role = 'owner'
);

-- Sprawdź użytkowników bez organizacji
SELECT 
  u.id,
  u.email,
  p.full_name
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE NOT EXISTS (
  SELECT 1 
  FROM organization_members om 
  WHERE om.user_id = u.id
);

-- ============================================
-- 5. STATYSTYKI
-- ============================================

-- Statystyki organizacji
SELECT 
  COUNT(*) as total_organizations,
  COUNT(DISTINCT om.user_id) as total_members,
  AVG(member_counts.cnt) as avg_members_per_org
FROM organizations o
LEFT JOIN organization_members om ON om.organization_id = o.id
LEFT JOIN (
  SELECT organization_id, COUNT(*) as cnt
  FROM organization_members
  GROUP BY organization_id
) member_counts ON member_counts.organization_id = o.id;

-- Rozkład ról
SELECT 
  role,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM organization_members
GROUP BY role
ORDER BY count DESC;

-- Aktywność w czasie
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_organizations
FROM organizations
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

-- ============================================
-- 6. CZYSZCZENIE (UWAGA!)
-- ============================================

-- UWAGA: Te komendy usuwają dane!
-- Używaj tylko w środowisku deweloperskim!

-- Usuń wszystkie organizacje (cascade usunie członków)
-- DELETE FROM organizations;

-- Usuń wszystkie profile (cascade usunie użytkowników z Auth)
-- DELETE FROM profiles;

-- Kompletny reset (usuwa wszystko!)
-- TRUNCATE 
--   organizations,
--   organization_members,
--   profiles
-- CASCADE;

-- ============================================
-- 7. OPTYMALIZACJA
-- ============================================

-- Sprawdź indeksy
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('organizations', 'organization_members', 'profiles')
ORDER BY tablename, indexname;

-- Analiza wydajności zapytań (włącz przed wolnym zapytaniem)
-- EXPLAIN ANALYZE
-- SELECT o.* 
-- FROM organizations o
-- JOIN organization_members om ON om.organization_id = o.id
-- WHERE om.user_id = 'some-user-id';

-- ============================================
-- 8. DODAWANIE NOWYCH TABEL DLA ORGANIZACJI
-- ============================================

-- Przykład: Tabela projektów dla organizacji
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks dla wydajności
CREATE INDEX idx_projects_organization_id ON projects(organization_id);

-- RLS dla projektów
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Członkowie organizacji mogą widzieć jej projekty
CREATE POLICY "Organization members can view projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Członkowie organizacji mogą tworzyć projekty
CREATE POLICY "Organization members can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );
