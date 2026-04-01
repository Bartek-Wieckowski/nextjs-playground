-- ============================================
-- RPC FUNCTIONS
-- Atomowe operacje wieloetapowe jako funkcje PostgreSQL.
-- Wywoływane przez service role (omijają RLS).
-- SECURITY DEFINER + SET search_path = public zapobiega
-- search_path injection i zapewnia deterministyczne rozwiązywanie nazw.
--
-- BRAK REKURENCJI:
-- is_member_of_org / is_admin_of_org są SECURITY DEFINER —
-- gdy sprawdzają organization_members, pomijają RLS tej tabeli,
-- więc polityki nigdy nie wywołują się nawzajem w pętli.
-- Funkcje poniżej też są SECURITY DEFINER, więc żadne RLS
-- nie jest w ogóle uruchamiane wewnątrz tych transakcji.
-- ============================================


-- ── add_member ────────────────────────────────────────────────────────────────
-- Atomowo: dodaje usera do organizacji, wpisuje audit log.
-- User musi być wcześniej stworzony przez auth.admin API (poza SQL).
-- Rzuca wyjątek jeśli user już jest członkiem organizacji.
-- Zwraca: id nowego wiersza w organization_members.

CREATE OR REPLACE FUNCTION add_member(
  p_organization_id UUID,
  p_user_id         UUID,
  p_role            organization_role,
  p_changed_by      UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_organization_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'AlreadyMember';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role, status)
  VALUES (p_organization_id, p_user_id, p_role, 'active')
  RETURNING id INTO v_member_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, new_data)
  VALUES ('member_added', 'organization_members', v_member_id, p_changed_by,
          jsonb_build_object('user_id', p_user_id, 'organization_id', p_organization_id,
                             'role', p_role, 'status', 'active'));

  RETURN v_member_id;
END;
$$;


-- ── update_member ─────────────────────────────────────────────────────────────
-- Atomowo: aktualizuje full_name w profiles + role/status w organization_members,
-- wpisuje audit log. Rzuca wyjątek jeśli member nie istnieje.

CREATE OR REPLACE FUNCTION update_member(
  p_member_id  UUID,
  p_org_id     UUID,
  p_full_name  TEXT,
  p_role       organization_role,
  p_status     member_status,
  p_changed_by UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_member organization_members%ROWTYPE;
  v_old_name   TEXT;
BEGIN
  SELECT * INTO v_old_member
  FROM organization_members
  WHERE id = p_member_id AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound';
  END IF;

  SELECT full_name INTO v_old_name
  FROM profiles WHERE id = v_old_member.user_id;

  UPDATE profiles
  SET full_name = p_full_name
  WHERE id = v_old_member.user_id;

  UPDATE organization_members
  SET role = p_role, status = p_status
  WHERE id = p_member_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, old_data, new_data)
  VALUES ('member_status_changed', 'organization_members', p_member_id, p_changed_by,
          jsonb_build_object('full_name', v_old_name, 'role', v_old_member.role,
                             'status', v_old_member.status),
          jsonb_build_object('full_name', p_full_name, 'role', p_role,
                             'status', p_status));
END;
$$;


-- ── approve_organization_request ──────────────────────────────────────────────
-- Atomowo: tworzy org, dodaje admina, zatwierdza request, wpisuje audit log.
-- User musi być wcześniej stworzony przez auth.admin API (poza SQL).
-- Kolizja sluga: jeśli slug zajęty, dodaje sufiks epoch.
-- Zwraca: id nowo utworzonej organizacji.

CREATE OR REPLACE FUNCTION approve_organization_request(
  p_request_id  UUID,
  p_org_name    TEXT,
  p_slug        TEXT,
  p_description TEXT,
  p_user_id     UUID,
  p_changed_by    UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_slug      TEXT := p_slug;
  v_org_id    UUID;
  v_member_id UUID;
BEGIN
  -- Obsługa kolizji sluga bez osobnego round-trip z JS
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || extract(epoch from now())::bigint::text;
  END IF;

  INSERT INTO organizations (name, slug, description, status)
  VALUES (p_org_name, v_slug, p_description, 'active')
  RETURNING id INTO v_org_id;

  INSERT INTO organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, p_user_id, 'admin', 'active')
  RETURNING id INTO v_member_id;

  UPDATE organization_requests
  SET status = 'approved', approved_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, new_data)
  VALUES
    ('org_created', 'organizations', v_org_id, p_changed_by,
     jsonb_build_object('name', p_org_name, 'slug', v_slug, 'status', 'active',
                        'source', 'organization_request', 'request_id', p_request_id)),
    ('member_added', 'organization_members', v_member_id, p_changed_by,
     jsonb_build_object('user_id', p_user_id, 'organization_id', v_org_id,
                        'role', 'admin', 'source', 'org_request_approval')),
    ('org_request_approved', 'organization_requests', p_request_id, p_changed_by,
     jsonb_build_object('status', 'approved', 'organization_id', v_org_id));

  RETURN v_org_id;
END;
$$;


-- ── create_organization ───────────────────────────────────────────────────────
-- Atomowo: sprawdza unikalność sluga, tworzy org, wpisuje audit log.
-- Rzuca wyjątek jeśli slug zajęty — obsłużony po stronie TS.
-- Zwraca: id nowej organizacji.

CREATE OR REPLACE FUNCTION create_organization(
  p_name        TEXT,
  p_slug        TEXT,
  p_description TEXT,
  p_status      org_status,
  p_changed_by    UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'SlugTaken';
  END IF;

  INSERT INTO organizations (name, slug, description, status)
  VALUES (p_name, p_slug, p_description, p_status)
  RETURNING id INTO v_org_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, new_data)
  VALUES ('org_created', 'organizations', v_org_id, p_changed_by,
          jsonb_build_object('name', p_name, 'slug', p_slug,
                             'status', p_status, 'description', p_description));

  RETURN v_org_id;
END;
$$;


-- ── update_organization ───────────────────────────────────────────────────────
-- Atomowo: sprawdza kolizję sluga, aktualizuje org, wpisuje audit log.
-- Zwraca stary status (potrzebny w TS do decyzji o forceSignOut).

CREATE OR REPLACE FUNCTION update_organization(
  p_id          UUID,
  p_name        TEXT,
  p_slug        TEXT,
  p_description TEXT,
  p_status      org_status,
  p_changed_by    UUID
)
RETURNS org_status   -- zwraca poprzedni status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old organizations%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM organizations WHERE slug = p_slug AND id != p_id
  ) THEN
    RAISE EXCEPTION 'SlugTaken';
  END IF;

  SELECT * INTO v_old FROM organizations WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound';
  END IF;

  UPDATE organizations
  SET name = p_name, slug = p_slug, description = p_description, status = p_status
  WHERE id = p_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, old_data, new_data)
  VALUES ('org_updated', 'organizations', p_id, p_changed_by,
          jsonb_build_object('name', v_old.name, 'slug', v_old.slug,
                             'description', v_old.description, 'status', v_old.status),
          jsonb_build_object('name', p_name, 'slug', p_slug,
                             'description', p_description, 'status', p_status));

  RETURN v_old.status;
END;
$$;


-- ── soft_delete_organization ──────────────────────────────────────────────────
-- Atomowo: ustawia deleted_at, wpisuje audit log.
-- Zwraca listę user_id memberów (TS wywołuje forceSignOut dla każdego).

CREATE OR REPLACE FUNCTION soft_delete_organization(
  p_id       UUID,
  p_changed_by UUID
)
RETURNS UUID[]   -- user_id wszystkich memberów do wylogowania
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ := NOW();
  v_member_ids UUID[];
BEGIN
  UPDATE organizations
  SET deleted_at = v_deleted_at
  WHERE id = p_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound';
  END IF;

  SELECT array_agg(user_id) INTO v_member_ids
  FROM organization_members
  WHERE organization_id = p_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, old_data, new_data)
  VALUES ('org_deleted', 'organizations', p_id, p_changed_by,
          jsonb_build_object('deleted_at', NULL),
          jsonb_build_object('deleted_at', v_deleted_at));

  RETURN coalesce(v_member_ids, '{}');
END;
$$;


-- ── restore_organization ──────────────────────────────────────────────────────
-- Atomowo: czyści deleted_at, przywraca status active, wpisuje audit log.

CREATE OR REPLACE FUNCTION restore_organization(
  p_id       UUID,
  p_changed_by UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE organizations
  SET deleted_at = NULL, status = 'active'
  WHERE id = p_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound';
  END IF;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, new_data)
  VALUES ('org_restored', 'organizations', p_id, p_changed_by,
          jsonb_build_object('deleted_at', NULL, 'status', 'active'));
END;
$$;


-- ── complete_super_admin_setup ───────────��─────────────────────────────────────
-- Atomowo: upsertuje profil, tworzy rekord super_admin, wpisuje audit log.
-- Guard: rzuca wyjątek jeśli super admin już istnieje (tylko bootstrap).
-- app_metadata (is_super_admin) musi być ustawione przez auth.admin API przed wywołaniem.
-- Zwraca: id wiersza w super_admins.

CREATE OR REPLACE FUNCTION complete_super_admin_setup(
  p_user_id   UUID,
  p_email     TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sa_id UUID;
BEGIN
  IF (SELECT COUNT(*) FROM super_admins) > 0 THEN
    RAISE EXCEPTION 'Super admin już istnieje. Setup zakończony.';
  END IF;

  INSERT INTO profiles (id, email, full_name)
  VALUES (p_user_id, p_email, p_full_name)
  ON CONFLICT (id) DO UPDATE SET email = p_email, full_name = p_full_name;

  INSERT INTO super_admins (user_id, granted_by)
  VALUES (p_user_id, NULL)
  RETURNING id INTO v_sa_id;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, new_data)
  VALUES ('super_admin_granted', 'super_admins', v_sa_id, p_user_id,
          jsonb_build_object('user_id', p_user_id, 'granted_by', NULL, 'source', 'bootstrap'));

  RETURN v_sa_id;
END;
$$;


-- ── accept_super_admin_invite ──────────────────────────────────────────────────
-- Atomowo: waliduje i blokuje zaproszenie (FOR UPDATE = brak race condition),
-- upsertuje profil, tworzy super_admin, oznacza invite jako użyte, audit log.
-- app_metadata (is_super_admin) musi być ustawione przez auth.admin API przed wywołaniem.
-- Zwraca: id wiersza w super_admins.

CREATE OR REPLACE FUNCTION accept_super_admin_invite(
  p_token     TEXT,
  p_user_id   UUID,
  p_email     TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite super_admin_invites%ROWTYPE;
  v_sa_id  UUID;
BEGIN
  -- FOR UPDATE: blokuje wiersz — dwa równoczesne żądania z tym samym tokenem
  -- nie mogą przejść jednocześnie (drugie poczeka, a potem dostanie NOT FOUND)
  SELECT * INTO v_invite
  FROM super_admin_invites
  WHERE token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link nieważny lub wygasł.';
  END IF;

  IF v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'Link wygasł.';
  END IF;

  IF lower(v_invite.email) != lower(p_email) THEN
    RAISE EXCEPTION 'Link wysłano na inny adres email.';
  END IF;

  INSERT INTO profiles (id, email, full_name)
  VALUES (p_user_id, p_email, p_full_name)
  ON CONFLICT (id) DO UPDATE SET email = p_email, full_name = p_full_name;

  INSERT INTO super_admins (user_id, granted_by)
  VALUES (p_user_id, v_invite.invited_by)
  RETURNING id INTO v_sa_id;

  UPDATE super_admin_invites
  SET status = 'used', used_at = NOW()
  WHERE token = p_token;

  INSERT INTO audit_log (action, table_name, row_id, changed_by, new_data)
  VALUES ('super_admin_granted', 'super_admins', v_sa_id, p_user_id,
          jsonb_build_object('user_id', p_user_id, 'granted_by', v_invite.invited_by, 'source', 'invite'));

  RETURN v_sa_id;
END;
$$;
