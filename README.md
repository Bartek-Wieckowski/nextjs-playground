# Multi-Tenant SaaS z Next.js i Supabase

Aplikacja demonstracyjna pokazująca implementację systemu multi-tenant z:
- **Next.js 15** (App Router)
- **Supabase** (Auth + Database)
- **Magic Link Authentication** (logowanie bez hasła)
- **Row Level Security (RLS)** dla izolacji danych
- **TypeScript** + **Tailwind CSS**

## Architektura Multi-Tenant

### Struktura bazy danych

```
users (auth.users) - użytkownicy Supabase Auth
    ↓
profiles - rozszerzone informacje o użytkownikach
    ↓
organization_members - łączenie users ↔ organizations (z rolami)
    ↓
organizations - organizacje/tenants
```

### Row Level Security (RLS)

Każda tabela ma polityki RLS, które zapewniają:
- Użytkownicy widzą tylko swoje organizacje
- Członkowie widzą tylko dane swojej organizacji
- Role (owner/admin/member) kontrolują uprawnienia

## Szybki start

### 1. Instalacja zależności

```bash
npm install
```

### 2. Uruchomienie lokalnej instancji Supabase

```bash
# Uruchom Supabase w Docker
supabase start

# Po uruchomieniu zobaczysz output z credentials:
# API URL: http://127.0.0.1:54321
# anon key: eyJhbG...
# service_role key: eyJhbG...
```

**Ważne**: Supabase CLI automatycznie:
- Uruchamia PostgreSQL w Docker
- Uruchamia Supabase Studio (http://127.0.0.1:54323)
- Uruchamia Inbucket (email testing) (http://127.0.0.1:54324)
- Aplikuje migracje z folderu `supabase/migrations/`

### 3. Konfiguracja zmiennych środowiskowych

Skopiuj przykładowy plik i uzupełnij danymi z `supabase start`:

```bash
cp .env.local.example .env.local
```

Edytuj `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<twój-anon-key-z-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<twój-service-role-key-z-supabase-start>
```

### 4. Uruchomienie aplikacji Next.js

```bash
npm run dev
```

Aplikacja będzie dostępna na `http://localhost:3000`

### 5. Testowanie Magic Link

1. Otwórz `http://localhost:3000`
2. Kliknij "Zarejestruj się"
3. Podaj email i nazwę
4. **Zobacz email w Inbucket**: `http://127.0.0.1:54324`
5. Kliknij link w emailu
6. Zostaniesz zalogowany i przekierowany do dashboardu

## Struktura projektu

```
nextjs-playground/
├── app/
│   ├── auth/
│   │   ├── callback/route.ts       # Callback po kliknięciu magic link
│   │   └── signout/route.ts        # Wylogowanie
│   ├── dashboard/
│   │   └── page.tsx                # Dashboard użytkownika
│   ├── login/
│   │   ├── page.tsx                # Strona logowania
│   │   └── magic-link-form.tsx     # Formularz magic link
│   ├── signup/
│   │   ├── page.tsx                # Strona rejestracji
│   │   └── signup-form.tsx         # Formularz rejestracji
│   ├── organizations/
│   │   └── [id]/page.tsx           # Szczegóły organizacji
│   └── page.tsx                    # Landing page
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase client (browser)
│   │   ├── server.ts               # Supabase client (server)
│   │   └── middleware.ts           # Auth middleware
│   └── organizations.ts            # Helper functions dla organizacji
├── supabase/
│   ├── migrations/
│   │   └── 20260325000000_initial_schema.sql  # Schemat bazy
│   └── config.toml                 # Konfiguracja Supabase
└── middleware.ts                   # Next.js middleware dla auth
```

## Funkcje

### ✅ Zaimplementowane

- [x] Magic Link authentication (bez hasła)
- [x] Automatyczne tworzenie profilu i pierwszej organizacji
- [x] Multi-tenant z Row Level Security
- [x] Role w organizacji (owner, admin, member)
- [x] Dashboard użytkownika
- [x] Lista organizacji
- [x] Podgląd członków organizacji
- [x] Protected routes (middleware)
- [x] Lokalne testowanie z Docker

### 🚧 Do rozbudowy

- [ ] Tworzenie nowych organizacji
- [ ] Zapraszanie członków do organizacji
- [ ] Zarządzanie rolami
- [ ] Usuwanie członków
- [ ] Edycja organizacji
- [ ] Dodanie tabel specyficznych dla organizacji (np. projekty, zadania)

## Jak działa Multi-Tenancy?

### 1. Rejestracja użytkownika

```sql
-- Trigger automatycznie tworzy:
-- 1. Profil w tabeli profiles
-- 2. Pierwszą organizację dla użytkownika
-- 3. Dodaje użytkownika jako owner organizacji
```

### 2. Row Level Security

```sql
-- Przykład polityki RLS dla organizations:
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );
```

### 3. Izolacja danych

- Każde zapytanie SQL automatycznie filtruje dane przez RLS
- Użytkownik widzi tylko organizacje, do których należy
- Brak możliwości dostępu do danych innych organizacji

## Supabase CLI - Przydatne komendy

```bash
# Uruchom lokalną instancję
supabase start

# Zatrzymaj lokalną instancję
supabase stop

# Zobacz status
supabase status

# Otwórz Supabase Studio
open http://127.0.0.1:54323

# Otwórz email testing (Inbucket)
open http://127.0.0.1:54324

# Reset bazy danych (usuwa wszystkie dane!)
supabase db reset

# Stwórz nową migrację
supabase migration new <nazwa_migracji>

# Zastosuj migracje (automatyczne przy supabase start)
supabase db push
```

## Połączenie z produkcyjną bazą Supabase

### 1. Stwórz projekt na [supabase.com](https://supabase.com)

### 2. Pobierz credentials z Dashboard

### 3. Zastosuj migracje na produkcję

```bash
# Link do projektu produkcyjnego
supabase link --project-ref <twoj-project-ref>

# Wypchnij migracje
supabase db push
```

### 4. Zaktualizuj `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
```

## Testowanie

### Testowanie Magic Link lokalnie

1. Uruchom `supabase start`
2. Otwórz Inbucket: `http://127.0.0.1:54324`
3. Zarejestruj się w aplikacji
4. Sprawdź email w Inbucket
5. Kliknij link w emailu

### Supabase Studio

Dashboard PostgreSQL dostępny na `http://127.0.0.1:54323`:
- Przeglądaj tabele
- Wykonuj zapytania SQL
- Zobacz polityki RLS
- Zarządzaj użytkownikami

## Troubleshooting

### Supabase nie uruchamia się

```bash
# Sprawdź czy Docker działa
docker ps

# Zatrzymaj wszystko i uruchom ponownie
supabase stop
supabase start
```

### Błąd "relation does not exist"

```bash
# Reset bazy i ponowne zastosowanie migracji
supabase db reset
```

### Magic Link nie działa

1. Sprawdź czy Inbucket działa: `http://127.0.0.1:54324`
2. Sprawdź `site_url` w `supabase/config.toml`
3. Upewnij się że `enable_confirmations = false` w config

## Licencja

MIT
