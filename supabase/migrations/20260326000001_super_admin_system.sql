-- ============================================
-- SUPER ADMIN SYSTEM
-- Tabela super adminów i zaproszeń do roli super admina.
-- Dostęp wyłącznie przez service role (brak RLS policies).
-- is_super_admin przechowywany też w JWT app_metadata
-- dla szybkiego sprawdzenia w middleware (zero extra DB queries).
-- ============================================

CREATE TYPE invite_status AS ENUM ('pending', 'used', 'expired');

-- ============================================
-- SUPER ADMINS
-- Źródło prawdy kto jest super adminem.
-- granted_by = NULL oznacza bootstrapped (pierwszy super admin).
-- ============================================

CREATE TABLE super_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SUPER ADMIN INVITES
-- Zaproszenia do roli super admina wysyłane przez istniejących super adminów.
-- Token jednorazowy, wygasa po 7 dniach.
-- ============================================

CREATE TABLE super_admin_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at    TIMESTAMPTZ
);

CREATE INDEX idx_super_admins_user_id      ON super_admins(user_id);
CREATE INDEX idx_super_admin_invites_token  ON super_admin_invites(token);
CREATE INDEX idx_super_admin_invites_email  ON super_admin_invites(email);
CREATE INDEX idx_super_admin_invites_status ON super_admin_invites(status);

ALTER TABLE super_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_invites ENABLE ROW LEVEL SECURITY;
-- Brak policies = tylko service role ma dostęp
