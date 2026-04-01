import { createAdminClient } from '@/lib/supabase/admin'
import { cacheTag } from 'next/cache'

export type AuditLogEntry = {
  id: string
  action: string
  table_name: string
  row_id: string
  changed_by: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  profiles: { email: string; full_name: string | null } | null
}

/**
 * Historia zmian dla konkretnego wiersza (np. jednej organizacji).
 * Cached per-row — invalidate with revalidateTag(`audit:${rowId}`).
 */
export async function getAuditLogForRow(rowId: string): Promise<AuditLogEntry[]> {
  'use cache'
  cacheTag('audit-log', `audit:${rowId}`)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audit_log')
    .select('*, profiles(email, full_name)')
    .eq('row_id', rowId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getAuditLogForRow error:', error)
    return []
  }

  return (data ?? []) as AuditLogEntry[]
}

/**
 * Globalna historia zmian (dla super admina).
 * Cached globally — invalidate with revalidateTag('audit-log').
 */
export async function getRecentAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  'use cache'
  cacheTag('audit-log')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audit_log')
    .select('*, profiles(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRecentAuditLog error:', error)
    return []
  }

  return (data ?? []) as AuditLogEntry[]
}
