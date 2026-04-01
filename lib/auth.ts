import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * getCurrentUser — per-request memoization via React.cache().
 * Multiple Server Components/Actions calling this in the same request
 * share a single getUser() call to Supabase.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
})

export const requireSuperAdmin = cache(async () => {
  const user = await getCurrentUser()
  if (user.app_metadata?.is_super_admin !== true) redirect('/dashboard')
  return user
})
