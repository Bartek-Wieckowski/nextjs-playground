import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Copy from: npx supabase status')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Config ────────────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL = 'superadmin@example.com'
const SUPER_ADMIN_2_EMAIL = 'superadmin2@example.com'
const SUPER_ADMIN_PASSWORD = 'password123'

const ORGS = [
  { name: 'Acme Corp', slug: 'acme-corp', description: 'Globalna firma technologiczna', status: 'active' as const },
  { name: 'Beta Studio', slug: 'beta-studio', description: 'Agencja kreatywna', status: 'active' as const },
  { name: 'Gamma SaaS', slug: 'gamma-saas', description: 'Platforma SaaS', status: 'suspended' as const },
]

const USERS = [
  { email: 'alice@acme.com', full_name: 'Alice Kowalska', org: 'acme-corp', role: 'admin' as const },
  { email: 'bob@acme.com', full_name: 'Bob Nowak', org: 'acme-corp', role: 'member' as const },
  { email: 'charlie@beta.com', full_name: 'Charlie Wiśniewski', org: 'beta-studio', role: 'admin' as const },
  { email: 'diana@beta.com', full_name: 'Diana Zając', org: 'beta-studio', role: 'member' as const },
  { email: 'eve@gamma.com', full_name: 'Eve Dąbrowska', org: 'gamma-saas', role: 'admin' as const },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createOrFindUser(email: string, fullName: string) {
  const { data: existing, error: listError } = await admin.auth.admin.listUsers()
  if (listError) throw listError

  const found = existing.users.find((u) => u.email === email)
  if (found) return found.id

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SUPER_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw new Error(`createUser(${email}): ${error.message}`)
  return data.user.id
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n')

  // 1. Super Admin
  console.log('→ Creating super admin:', SUPER_ADMIN_EMAIL)
  const superAdminId = await createOrFindUser(SUPER_ADMIN_EMAIL, 'Super Admin')

  await admin.auth.admin.updateUserById(superAdminId, {
    app_metadata: { is_super_admin: true },
    user_metadata: { full_name: 'Super Admin' },
  })

  await admin
    .from('profiles')
    .upsert({ id: superAdminId, email: SUPER_ADMIN_EMAIL, full_name: 'Super Admin' }, { onConflict: 'id' })

  const { data: superAdminRow } = await admin
    .from('super_admins')
    .upsert({ user_id: superAdminId, granted_by: null }, { onConflict: 'user_id' })
    .select('user_id')
    .single()

  console.log('  ✓ Super admin set up\n')

  // 1b. Second Super Admin (granted_by = first super admin)
  console.log('→ Creating second super admin:', SUPER_ADMIN_2_EMAIL)
  const superAdmin2Id = await createOrFindUser(SUPER_ADMIN_2_EMAIL, 'Super Admin 2')

  await admin.auth.admin.updateUserById(superAdmin2Id, {
    app_metadata: { is_super_admin: true },
    user_metadata: { full_name: 'Super Admin 2' },
  })

  await admin
    .from('profiles')
    .upsert({ id: superAdmin2Id, email: SUPER_ADMIN_2_EMAIL, full_name: 'Super Admin 2' }, { onConflict: 'id' })

  await admin
    .from('super_admins')
    .upsert({ user_id: superAdmin2Id, granted_by: superAdminRow?.user_id ?? superAdminId }, { onConflict: 'user_id' })

  console.log('  ✓ Second super admin set up\n')

  // 2. Organizations
  console.log('→ Creating organizations...')
  const orgMap: Record<string, string> = {}

  for (const org of ORGS) {
    const { data, error } = await admin
      .from('organizations')
      .upsert({ name: org.name, slug: org.slug, description: org.description, status: org.status }, { onConflict: 'slug' })
      .select('id')
      .single()

    if (error) throw new Error(`org(${org.slug}): ${error.message}`)
    orgMap[org.slug] = data.id
    console.log(`  ✓ ${org.name} (${org.status})`)
  }

  console.log()

  // 3. Users + members
  console.log('→ Creating users and memberships...')
  for (const user of USERS) {
    const userId = await createOrFindUser(user.email, user.full_name)
    const orgId = orgMap[user.org]

    await admin
      .from('organization_members')
      .upsert(
        { organization_id: orgId, user_id: userId, role: user.role, status: 'active' },
        { onConflict: 'organization_id,user_id' },
      )

    console.log(`  ✓ ${user.full_name} (${user.email}) → ${user.org} [${user.role}]`)
  }

  console.log('\n✅ Seed complete!')
  console.log(`\nSuper Admin: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`)
  console.log('Regular users password: password123')
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
