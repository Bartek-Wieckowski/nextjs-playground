-- ============================================
-- ORGANIZATION REQUESTS
-- Wnioski o założenie nowej organizacji.
-- Dostęp wyłącznie przez service role (brak RLS policies).
-- Token generowany automatycznie przez DB.
-- ============================================

CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE organization_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  description       TEXT,
  token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status            request_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  approved_at       TIMESTAMPTZ
);

CREATE INDEX idx_organization_requests_token  ON organization_requests(token);
CREATE INDEX idx_organization_requests_status ON organization_requests(status);

ALTER TABLE organization_requests ENABLE ROW LEVEL SECURITY;
-- Brak policies = tylko service role ma dostęp
