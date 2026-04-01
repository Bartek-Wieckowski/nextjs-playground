# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build
npm run lint      # Run ESLint

# Supabase local development
npx supabase start                       # Start local Supabase stack
npx supabase stop                        # Stop local Supabase stack
npx supabase status                      # Show API keys and URLs
npx supabase db reset                    # Drop + recreate + run all migrations
npx supabase migration new <name>        # Create a new migration file

# Database
npm run db:types   # Regenerate lib/database.types.ts from local DB
npm run db:seed    # Run supabase/seed.ts
npm run db:reset   # db reset + types + seed (all at once)

# Tests
npm run test       # Vitest (unit/component) — watch mode
npm run test:e2e   # Playwright E2E
npm run test:e2e:ui  # Playwright interactive UI
```

## Architecture

Multi-tenant SaaS learning project built with Next.js App Router. Implements organization request/approval workflow, super-admin panel, member management, and audit logging.

### Key Data Flows

**Organization request flow:**
1. User submits request on home page → saved to `organization_requests` table
2. `OWNER_EMAIL` receives approval email with link to `/approve-organization?token=...`
3. Owner opens the page → Server Action with `SUPABASE_SERVICE_ROLE_KEY`:
   - Creates the organization
   - Creates or looks up the user
   - Adds user as org admin member
   - Sends magic link welcome email
4. User clicks magic link → `/auth/callback` exchanges token → redirect to `/dashboard`

**Super admin setup (one-time bootstrap):**
1. Go to `/super-admin/setup?bootstrap_token=<BOOTSTRAP_SETUP_TOKEN>`
2. Complete setup → `app_metadata.is_super_admin = true` set via admin client
3. Subsequent super admins via invite: `/super-admin` → invite → `/super-admin/join?token=...`

### Supabase Client Hierarchy

Three distinct clients — use the right one:

- `lib/supabase/client.ts` — Browser client (anon key, Client Components)
- `lib/supabase/server.ts` — Server client (anon key + cookies, Server Components/Actions)
- `lib/supabase/admin.ts` — Admin client (service role key, bypasses RLS — trusted server-side only)

**Rule:** Server Actions and DAL always use `createAdminClient()`. Auth checks are done in code (`requireSuperAdmin`, `requireOrgAdmin`), not via RLS.

### Route Protection

Middleware at `lib/supabase/middleware.ts`:
- `/super-admin/setup`, `/super-admin/join` — requires authenticated session (page verifies token/invite itself)
- `/super-admin/*` — requires `user.app_metadata.is_super_admin === true`
- `/dashboard` — requires authenticated session + active org membership
- `/login` — redirects authenticated users to their destination

Super admin check uses JWT `app_metadata` (set by service role, cannot be tampered by user).

### Architecture Layers

```
app/                    Next.js App Router pages
lib/actions/            Server Actions (mutations: write + cache invalidation)
  auth.ts               signOut
  organizations.ts      createOrganization, updateOrganization, softDelete, restore, approveRequest
  super-admin.ts        completeSuperAdminSetup, inviteSuperAdmin, acceptSuperAdminInvite
  members.ts            updateMemberStatus, removeMember
  request-organization.ts  public org request form
lib/dal/                Data Access Layer (reads with 'use cache')
  organizations.ts      getOrganizationsForUser, getOrganizationMembers, getAllOrganizations, getDeletedOrganizations
  audit-log.ts          getAuditLogForRow, getRecentAuditLog
lib/auth.ts             getCurrentUser(), requireSuperAdmin() — React.cache() deduplication
lib/schemas/            Zod validation schemas
lib/email.ts            nodemailer — org request, welcome, super admin invite emails
lib/audit.ts            logAudit() — called from actions, never blocks main operation
```

### Database Schema

Tables: `profiles`, `organizations`, `organization_members`, `organization_requests`, `super_admin_invites`, `audit_log`

RLS enabled on all tables. Helper functions:
- `is_member_of_org(org_id)` — checks `status = 'active'` membership
- `is_admin_of_org(org_id)` — checks `role = 'admin'` + `status = 'active'`

INSERT/DELETE on `organizations` and `organization_members` restricted to service role.

### Cache Strategy

- `React.cache()` — deduplication within a single request (e.g. `getCurrentUser()`)
- `'use cache'` + `cacheTag(...)` in DAL — persistent cache across requests
- `updateTag(...)` in Server Actions — invalidates after mutations

DAL functions cannot read cookies — they accept `userId`/`orgId` as parameters and use `createAdminClient()`.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BOOTSTRAP_SETUP_TOKEN=     # One-time super admin bootstrap token
OWNER_EMAIL=               # Who receives org approval emails
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=
SMTP_FROM=
```
