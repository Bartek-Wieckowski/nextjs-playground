import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'org_created'
  | 'org_updated'
  | 'org_deleted'
  | 'org_restored'
  | 'org_request_submitted'
  | 'org_request_approved'
  | 'member_added'
  | 'member_status_changed'
  | 'member_removed'
  | 'super_admin_granted'
  | 'super_admin_invited'

type LogAuditParams = {
  action: AuditAction
  table: string
  rowId: string
  changedBy: string | null
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
}

/**
 * Zapisuje wpis w audit_log. Nigdy nie rzuca błędu — awaria logowania
 * nie może blokować głównej operacji.
 */
export async function logAudit({
  action,
  table,
  rowId,
  changedBy,
  oldData,
  newData,
}: LogAuditParams): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_log').insert({
      action,
      table_name: table,
      row_id: rowId,
      changed_by: changedBy,
      old_data: oldData ?? null,
      new_data: newData ?? null,
    })
    if (error) console.error('Audit log insert error:', error)
  } catch (err) {
    console.error('Audit log unexpected error:', err)
  }
}
