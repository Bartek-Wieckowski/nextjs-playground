CREATE TYPE audit_action AS ENUM (
  'org_created',
  'org_updated',
  'org_deleted',
  'org_restored',
  'org_request_submitted',
  'org_request_approved',
  'member_added',
  'member_status_changed',
  'member_removed',
  'super_admin_granted',
  'super_admin_invited'
);

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      audit_action NOT NULL,
  table_name  TEXT NOT NULL,
  row_id      UUID NOT NULL,
  changed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_data    JSONB,
  new_data    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_row     ON audit_log(table_name, row_id);
CREATE INDEX idx_audit_log_by      ON audit_log(changed_by);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Brak policies = tylko service role
