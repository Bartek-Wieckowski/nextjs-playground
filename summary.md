# Project Summary — Multi-tenant SaaS

## Komendy

```bash
# Dev
npm run dev                  # localhost:3000

# Supabase local
npx supabase start           # uruchom stack (DB, Auth, Studio na :54323)
npx supabase stop            # zatrzymaj
npx supabase status          # klucze API, URL-e

# Migracje
npx supabase migration new <nazwa>   # utwórz nowy plik migracji
npx supabase db reset                # reset DB + aplikuj wszystkie migracje

# Types + Seed
npm run db:types             # generuj lib/database.types.ts z lokalnej bazy
npm run db:seed              # npx tsx supabase/seed.ts
npm run db:reset             # reset + types + seed (wszystko naraz)

# Build / Lint
npm run build
npm run lint

# Testy
npm run test                 # vitest (unit + components)
npm run test:ui              # vitest z UI
npm run test:e2e             # playwright
npm run test:e2e:ui          # playwright z UI
```

---

## Architektura — warstwy

```
┌─────────────────────────────────────────────────┐
│  app/ (Next.js App Router)                      │
│  ├── /super-admin/*   — panel super admina      │
│  ├── /dashboard       — panel użytkownika       │
│  ├── /approve-org     — zatwierdzanie wniosków  │
│  ├── /login           — logowanie               │
│  └── /auth/callback   — Route Handler (OAuth)   │
├─────────────────────────────────────────────────┤
│  lib/actions/ (Server Actions — mutacje)        │
│  ├── auth.ts          — signOut                 │
│  ├── organizations.ts — CRUD org, approve       │
│  ├── super-admin.ts   — bootstrap, invite       │
│  └── members.ts       — status, remove          │
├─────────────────────────────────────────────────┤
│  lib/dal/ (Data Access Layer — odczyty z cache) │
│  └── organizations.ts — getOrganizationsForUser │
│                         getOrganizationMembers  │
│                         getAllOrganizations      │
├─────────────────────────────────────────────────┤
│  lib/schemas/ (Zod — walidacja wejścia)         │
│  ├── organization.ts                            │
│  ├── super-admin.ts                             │
│  └── member.ts                                  │
├─────────────────────────────────────────────────┤
│  lib/auth.ts  (getCurrentUser, requireSuperAdmin│
│               — React.cache() deduplifikacja)   │
├─────────────────────────────────────────────────┤
│  lib/supabase/                                  │
│  ├── client.ts   — Browser (anon key)           │
│  ├── server.ts   — Server (anon + cookies)      │
│  └── admin.ts    — Admin (service role, no RLS) │
└─────────────────────────────────────────────────┘
```

---

## Supabase klienty — który kiedy

| Klient | Gdzie używać | Klucz | RLS |
|--------|-------------|-------|-----|
| `createClient()` (server) | Server Components, middleware | anon | ✅ aktywne |
| `createClient()` (client) | Client Components | anon | ✅ aktywne |
| `createAdminClient()` | Server Actions, DAL, Route Handlers | service role | ❌ pomijane |

**Zasada:** w Server Actions i DAL zawsze `createAdminClient()` — bo sprawdzasz uprawnienia przez `requireSuperAdmin()` / `requireOrgAdmin()` w kodzie, nie przez RLS.

---

## Auth — jak działa

1. Użytkownik loguje się magic linkiem → Supabase wysyła email
2. Link prowadzi do `/auth/callback?code=...&next=/dashboard`
3. Route Handler wymienia kod na sesję + ustawia cookie
4. Middleware (`lib/supabase/middleware.ts`) sprawdza sesję przy każdym request
5. `getCurrentUser()` (Server Component/Action) → `supabase.auth.getUser()` — weryfikuje JWT z serwerem Supabase (bezpieczne, nie `getSession()`)

### Super Admin check

```ts
// Szybki check w middleware — z app_metadata w JWT (bez DB query)
user.app_metadata?.is_super_admin === true

// Pewny check w Server Action / Server Component
const user = await requireSuperAdmin() // rzuca redirect jeśli nie SA
```

`app_metadata` jest ustawiane przez admin client i nie może być zmienione przez usera — bezpieczne jako JWT claim.

---

## Cache — jak działa

### `React.cache()` — deduplifikacja per-request

```ts
// lib/auth.ts
export const getCurrentUser = cache(async () => { ... })
```

Jeśli layout, strona i 3 komponenty w tym samym renderze wywołają `getCurrentUser()` — tylko **1** request do Supabase. Reset przy każdym nowym request HTTP.

### `'use cache'` — persistent cache między requestami

```ts
// lib/dal/organizations.ts
export async function getAllOrganizations() {
  'use cache'
  cacheTag('organizations')   // etykieta do invalidacji
  // ...
}
```

Dane są cache'owane. Po mutacji w Server Action:
```ts
updateTag('organizations')              // invaliduje wszystkie z tym tagiem
updateTag(`org-members:${orgId}`)       // tylko konkretna org
updateTag(`user-orgs:${userId}`)        // tylko konkretny user
```

### Tagi w projekcie

| Tag | Kiedy invalidować |
|-----|-------------------|
| `organizations` | create/update/delete/restore org, approve request |
| `user-orgs:${userId}` | (subset `organizations`) |
| `org-members:${orgId}` | updateMemberStatus, removeMember |

---

## Zod — walidacja

Każda Server Action parsuje dane przez schemat przed dotknięciem bazy:

```ts
const parsed = CreateOrgSchema.safeParse({
  name: formData.get('name') ?? '',
  slug: (formData.get('slug') as string) || undefined,  // null → undefined
})
if (!parsed.success) {
  return { success: false, error: parsed.error.issues[0].message }
}
const { name, slug } = parsed.data  // w pełni typowane
```

**Ważne:** `FormData.get()` zwraca `string | null` — trzeba skonwertować na `string | undefined` przed podaniem do Zod (Zod nie akceptuje `null` tam gdzie oczekuje `undefined`).

---

## lib/actions/ vs lib/dal/ — czym się różnią

### lib/actions/ — mutacje (zapis)

Każdy plik = jeden obszar domeny. Eksportuje **Server Actions** (`'use server'`).

**Odpowiada za:**
- Zapis do bazy (INSERT, UPDATE, DELETE)
- Walidację wejścia przez Zod przed zapisem
- Sprawdzenie uprawnień (`requireSuperAdmin`, `requireOrgAdmin`)
- Inwalidację cache po zapisie (`updateTag`)
- Zwrócenie `{ success, error }` z powrotem do formularza

**Zasady:**
- Zawsze `'use server'` na górze
- Zawsze Zod przed dotknięciem bazy
- Zawsze `createAdminClient()` — uprawnienia sprawdzasz w kodzie, nie przez RLS
- Nigdy nie cachuje — każde wywołanie = świeży zapis
- Nigdy nie fetchuje danych do wyświetlenia — od tego jest DAL

```
lib/actions/
├── auth.ts          signOut()
├── organizations.ts createOrganization, updateOrganization, softDelete, restore, approveRequest
├── super-admin.ts   completeSuperAdminSetup, inviteSuperAdmin, acceptSuperAdminInvite
└── members.ts       updateMemberStatus, removeMember
```

### lib/dal/ — odczyty (fetch + cache)

DAL = Data Access Layer. Eksportuje zwykłe `async function` z `'use cache'`.

**Odpowiada za:**
- Pobieranie danych z bazy do wyświetlenia
- Cache'owanie wyników między requestami (`'use cache'` + `cacheTag`)
- Otagowanie cache dla precyzyjnej inwalidacji

**Zasady:**
- `'use cache'` na górze każdej funkcji
- `cacheTag(...)` zaraz po `'use cache'` — przed pierwszym `await`
- Przyjmuje `userId`/`orgId` jako parametr — **nie czyta cookies** (cache nie może)
- Zawsze `createAdminClient()` — brak cookies = brak anon clienta
- Nigdy nie zapisuje do bazy — od tego są actions

```
lib/dal/
└── organizations.ts  getOrganizationsForUser(userId), getOrganizationMembers(orgId),
                      getAllOrganizations(), getDeletedOrganizations()
```

### Przepływ danych

```
User klika "Zapisz"
       ↓
[Client Component]
useActionState → formAction
       ↓
[lib/actions/xxx.ts]   ← 'use server', Zod, DB write, updateTag('tag')
       ↓
updateTag inwaliduje cache dla 'tag'
       ↓
Next.js re-renderuje Server Component
       ↓
[lib/dal/xxx.ts]       ← 'use cache', cacheTag('tag'), DB read (świeże dane)
       ↓
Strona pokazuje zaktualizowane dane
```

**Dlaczego DAL nie może czytać cookies:**
`'use cache'` serializuje wejście i wyjście funkcji. Cookies zmieniają się per-request — gdyby funkcja cache'owana czytała cookies, każdy user miałby ten sam cache. Dlatego DAL przyjmuje `userId` (pobrane wcześniej przez `getCurrentUser()` poza cache) i używa admin clienta.

---

## Migracje — pełny workflow od SQL do UI

### Krok po kroku — zmiana w bazie danych

Każda zmiana w bazie przechodzi przez ten sam pipeline. Poniżej konkretny przykład: dodanie pola `website` do `organizations`.

---

**1. Utwórz migrację**

```bash
npx supabase migration new add_website_to_organizations
# → tworzy: supabase/migrations/20260401120000_add_website_to_organizations.sql
```

Edytuj wygenerowany plik:

```sql
ALTER TABLE organizations ADD COLUMN website TEXT;
```

---

**2. Zastosuj do lokalnej bazy**

```bash
npx supabase db reset
# = drop + recreate + wszystkie migracje od nowa + seed
```

Alternatywnie bez resetu (szybsze, ale ryzykowne przy zależnościach):
```bash
npx supabase db push
```

---

**3. Regeneruj typy TypeScript**

```bash
npm run db:types
# → nadpisuje lib/database.types.ts (nigdy nie edytuj ręcznie tego pliku)
```

`lib/database.types.ts` to auto-generated — zawiera pełny schemat bazy jako typy TS.

---

**4. Zaktualizuj lib/types.ts**

`lib/types.ts` to Twoje ręczne typy domenowe — tu dodajesz nowe pole:

```ts
export type Organization = {
  // ... istniejące pola
  website: string | null   // ← dodaj
}
```

Dlaczego ręcznie? Bo `lib/database.types.ts` ma wszystkie tabele i jest długi — `lib/types.ts` to uproszczone typy których używasz w UI. Możesz też tworzyć aliasy z `database.types.ts` jeśli wolisz.

---

**5. Zaktualizuj schemat Zod**

`lib/schemas/organization.ts` — dodaj nowe pole do walidacji:

```ts
export const UpdateOrgSchema = z.object({
  // ... istniejące pola
  website: z.string().url('Nieprawidłowy URL').optional(),
})
```

Zod jest jedynym miejscem gdzie definiujesz reguły biznesowe wejścia (min/max length, format URL, enum values). Jeśli pole jest wymagane w bazie — zrób je `z.string().min(1)`. Jeśli nullable — `.optional()`.

---

**6. Zaktualizuj Server Action**

`lib/actions/organizations.ts` — dodaj pole do `safeParse`:

```ts
const parsed = UpdateOrgSchema.safeParse({
  // ... istniejące pola
  website: (formData.get('website') as string) || undefined,
})
// ...
await admin.from('organizations').update({
  // ... istniejące pola
  website: parsed.data.website ?? null,
})
```

`updateTag('organizations')` już jest na końcu — nic nie trzeba zmieniać w cache.

---

**7. Zaktualizuj DAL (jeśli pole ma być w odczycie)**

`lib/dal/organizations.ts` — `.select('*')` automatycznie pobiera nowe pole. Jeśli zmienisz select na konkretne kolumny, dodaj `website`:

```ts
.select('id, name, slug, website, ...')
```

`'use cache'` i `cacheTag` bez zmian.

---

**8. Dodaj UI**

W `app/super-admin/components/organizations-table.tsx` dodaj input w formularzu edycji:

```tsx
<input name="website" defaultValue={org.website ?? ''} placeholder="https://..." />
```

---

### Konwencje migracji

- Jedna migracja = jedna logiczna zmiana
- Nazwy: `YYYYMMDDHHMMSS_opis_zmiany.sql` (Supabase generuje timestamp automatycznie)
- ENUM zamiast `TEXT CHECK IN (...)` — Supabase Studio pokazuje dropdown przy edycji wiersza
- Soft delete przez `deleted_at TIMESTAMPTZ DEFAULT NULL` — nigdy `DROP` / `DELETE` na danych produkcyjnych
- Nowa tabela zawsze z: `id UUID`, `created_at`, RLS enabled, policies

### Nowa tabela — checklist

```sql
-- 1. ENUM (opcjonalnie)
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid');

-- 2. Tabela
CREATE TABLE invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status      invoice_status NOT NULL DEFAULT 'draft',
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Trigger updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org invoices"
  ON invoices FOR SELECT
  USING (is_member_of_org(org_id));
```

Potem w kodzie:
1. `npm run db:types`
2. Typy w `lib/types.ts`
3. Schemat Zod w `lib/schemas/invoice.ts`
4. DAL w `lib/dal/invoices.ts` (odczyty z `'use cache'`, `cacheTag('invoices')`)
5. Actions w `lib/actions/invoices.ts` (mutacje z Zod, `updateTag('invoices')`)
6. Strona w `app/dashboard/invoices/page.tsx`
7. Formularz jako `'use client'` z `useActionState`

---

## Struktura pliku Server Action

```ts
'use server'

import { requireSuperAdmin } from '@/lib/auth'  // lub getCurrentUser
import { updateTag } from 'next/cache'
import { MySchema } from '@/lib/schemas/my-schema'

export type MyActionState = { success: boolean; error?: string }

export async function myAction(
  _prevState: MyActionState,
  formData: FormData,
): Promise<MyActionState> {
  // 1. Auth check
  try { await requireSuperAdmin() } catch {
    return { success: false, error: 'Brak uprawnień.' }
  }

  // 2. Validate
  const parsed = MySchema.safeParse({ field: formData.get('field') ?? '' })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  // 3. DB operation
  const admin = createAdminClient()
  const { error } = await admin.from('my_table').insert(parsed.data)
  if (error) return { success: false, error: 'Błąd zapisu.' }

  // 4. Invalidate cache
  updateTag('my-tag')
  return { success: true }
}
```

---

## Struktura Client Component z akcją

```tsx
'use client'

import { useActionState } from 'react'
import { myAction, type MyActionState } from '@/lib/actions/my-actions'

const initial: MyActionState = { success: false }

export function MyForm() {
  const [state, formAction, isPending] = useActionState(myAction, initial)

  return (
    <form action={formAction}>
      <input name="field" required />
      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.success && <p className="text-green-600">Zapisano.</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Zapisywanie...' : 'Zapisz'}
      </button>
    </form>
  )
}
```

---

## Zmiana statusu i blokowanie dostępu

### Org status
- `active` — normalne działanie
- `suspended` — RLS blokuje dane, dashboard pokazuje komunikat
- `cancelled` — permanentnie wyłączona

### Member status
- `active` — pełny dostęp
- `suspended` — RLS blokuje dostęp przez `is_member_of_org()` / `is_admin_of_org()` które sprawdzają `status = 'active'`

### Jak RLS blokuje automatycznie
```sql
-- Funkcja pomocnicza w DB
CREATE FUNCTION is_member_of_org(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'        -- ← zawieszony member = brak dostępu
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## Audit Log

### Co jest logowane

Każda istotna mutacja w bazie danych tworzy wpis w `audit_log`. Awaria logowania **nigdy nie blokuje** głównej operacji — `logAudit()` łapie błędy wewnętrznie.

| Akcja | Źródło | Kto (`changed_by`) |
|-------|--------|--------------------|
| `org_created` | createOrganization, approveOrganizationRequest | super admin |
| `org_updated` | updateOrganization | super admin |
| `org_deleted` | softDeleteOrganization | super admin |
| `org_restored` | restoreOrganization | super admin |
| `org_request_submitted` | submitOrganizationRequest | `null` (publiczne) |
| `org_request_approved` | approveOrganizationRequest | super admin |
| `member_added` | approveOrganizationRequest | super admin |
| `member_status_changed` | updateMemberStatus | org admin |
| `member_removed` | removeMember | org admin |
| `super_admin_granted` | completeSuperAdminSetup, acceptSuperAdminInvite | user |
| `super_admin_invited` | inviteSuperAdmin | super admin |

### Struktura tabeli

```sql
audit_log (
  id          UUID,
  action      audit_action,   -- ENUM
  table_name  TEXT,           -- 'organizations', 'organization_members', itd.
  row_id      UUID,           -- ID zmienionego wiersza
  changed_by  UUID,           -- NULL = anonimowy użytkownik
  old_data    JSONB,          -- stan przed zmianą (NULL jeśli CREATE)
  new_data    JSONB,          -- stan po zmianie (NULL jeśli DELETE)
  created_at  TIMESTAMPTZ
)
```

### Odczyt historii

```ts
// lib/dal/audit-log.ts
getAuditLogForRow(rowId)   // historia jednego wiersza (orga, membera)
getRecentAuditLog(limit)   // globalna historia dla super admina
```

Obie funkcje mają `'use cache'` + `cacheTag('audit-log', \`audit:${rowId}\`)`.
Inwalidacja po mutacji: `updateTag(\`audit:${id}\`)` (już w softDelete i restore).

### Skalowanie audit logu

Audit log rośnie liniowo z liczbą operacji. Przy dużej skali stosuje się trzy strategie:

**1. Partycjonowanie (PostgreSQL native)**

```sql
-- Zamiast zwykłej tabeli — tabela partycjonowana po miesiącach
CREATE TABLE audit_log (...)
  PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_03
  PARTITION OF audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

Każda partycja to osobny plik na dysku — zapytania z `WHERE created_at > ...` skanują tylko właściwe partycje, nie całą tabelę. `pg_partman` automatyzuje tworzenie nowych partycji.

**2. Retencja (usuwanie starych wpisów)**

```sql
-- Cron job (np. pg_cron) — usuwa wpisy starsze niż 2 lata
SELECT cron.schedule('0 3 1 * *', $$
  DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '2 years'
$$);
```

W Supabase można to skonfigurować przez Dashboard → Database → Cron Jobs.

**3. Archiwizacja do cold storage**

Przed usunięciem eksportuj stare wpisy do S3/R2 jako JSONL lub Parquet (np. przez `pg_dump --table=audit_log` z filtrem daty). Dane są zachowane, ale nie zajmują miejsca w DB.

### Kiedy to realny problem?

Dla typowego SaaS B2B (organizacje, memberowie) audit log rośnie wolno — kilka wpisów dziennie per organizacja. Problemy zaczynają się przy **~100M+ wierszy** lub gdy masz high-frequency events (np. logi każdego logowania). Przy obecnym zakresie (org CRUD, member management) partycjonowanie jest potrzebne dopiero przy setkach tysięcy organizacji.

---

## Zmienne środowiskowe

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # z: npx supabase status
SUPABASE_SERVICE_ROLE_KEY=...          # z: npx supabase status

BOOTSTRAP_SETUP_TOKEN=twoj-tajny-token # do first-time super admin setup

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
SMTP_FROM=noreply@example.com
OWNER_EMAIL=owner@example.com          # kto dostaje emaile z wnioskami
```

---

## Środowisko lokalne — pierwsze uruchomienie

```bash
# 1. Zależności
npm install

# 2. Supabase
npx supabase start               # uruchom stack
npx supabase status              # skopiuj klucze do .env.local

# 3. Baza + typy + seed
npm run db:reset

# 4. Dev server
npm run dev

# 5. Bootstrap super admina (jednorazowo)
# Zaloguj się na localhost:3000/login jako superadmin@example.com
# Przejdź do: localhost:3000/super-admin/setup?bootstrap_token=twoj-tajny-token
```

---

## Testy

### Vitest (unit + komponenty)
```bash
npm run test          # watch mode
npm run test:ui       # przeglądarka z UI

# Przykładowy test komponentu
# __tests__/components/status-badge.test.tsx
```

### Playwright (E2E)
```bash
npx playwright install chromium   # raz, instalacja przeglądarki
npm run test:e2e                  # uruchom testy
npm run test:e2e:ui               # interaktywny runner

# Testy w: e2e/*.spec.ts
```

Playwright ma `fullyParallel: false` — lokalny Supabase nie lubi równoległych zapisów.

---

## Najczęstsze pułapki

| Problem | Rozwiązanie |
|---------|-------------|
| `getUser()` vs `getSession()` | Zawsze `getUser()` — weryfikuje z serwerem. `getSession()` dekoduje lokalnie, można sfałszować. |
| Pusty cache po `updateTag` | Sprawdź czy `cacheTag` w DAL i `updateTag` w akcji mają identyczny string. |
| Supabase typy niezgodne | `npm run db:types` po każdej zmianie schematu. |
| `FormData.get()` zwraca `null` | Użyj `?? ''` przy przekazywaniu do Zod. |
| `'use cache'` nie może czytać cookies | DAL funkcje używają `createAdminClient()`, nie `createClient()`. Przyjmują `userId` jako parametr. |
| Server Action redirect przez `try/catch` | `redirect()` rzuca błąd — nie łap go w `try/catch` obejmującym cały action. |
| Middleware redirect + Server Action POST | `NextResponse.redirect()` domyślnie 307 — zachowuje metodę POST. Browser re-POSTuje do strony logowania, React dostaje HTML zamiast RSC payload → "An unexpected response". Fix: `NextResponse.redirect(url, 302)`. |
| Vitest zbiera pliki Playwright | Domyślny glob Vitest łapie `e2e/*.spec.ts`. Fix w `vitest.config.ts`: `include: ['tests/**/*.{test,spec}.ts?(x)'], exclude: ['e2e/**']`. |

## Pomocnicze funkcje

### generateSlug (lib/organizations.ts)

Używa biblioteki `slugify` z opcją `{ lower: true, strict: true }`:
- `Müller GmbH` → `muller-gmbh`
- `Café & Łódź` → `cafe-and-lodz` (`&` → `and`, nie usuwane)
- `Żółta Łódź` → `zolta-lodz`

Uwaga: `strict: true` + `slugify` tłumaczy `&` na `and` — to poprawne zachowanie semantyczne.
