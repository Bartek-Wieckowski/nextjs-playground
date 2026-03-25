# 🚀 Szybki Start - Multi-Tenant SaaS

## Co zostało skonfigurowane?

✅ Next.js 15 z TypeScript i Tailwind CSS  
✅ Supabase lokalnie (Docker) z migracjami  
✅ Magic Link authentication  
✅ Multi-tenant architecture (RLS)  
✅ Automatyczne tworzenie organizacji dla nowych użytkowników  
✅ Middleware do ochrony tras  

## Jak uruchomić?

### 1. Supabase już działa! 🎉

```bash
# Sprawdź status
supabase status
```

**Ważne adresy:**
- 🎨 Studio: http://127.0.0.1:54323
- 📧 Email testing (Mailpit): http://127.0.0.1:54324
- 🔌 API: http://127.0.0.1:54321

### 2. Uruchom Next.js

```bash
npm run dev
```

Otwórz: http://localhost:3000

### 3. Przetestuj aplikację

1. **Zarejestruj się**
   - Kliknij "Zarejestruj się"
   - Podaj imię i email
   - Kliknij "Wyślij magiczny link"

2. **Sprawdź email**
   - Otwórz Mailpit: http://127.0.0.1:54324
   - Znajdź email z linkiem
   - Kliknij link

3. **Zobacz dashboard**
   - Zostaniesz zalogowany
   - Zobaczysz swoją pierwszą organizację (utworzoną automatycznie)
   - Kliknij na organizację, aby zobaczyć szczegóły

## Jak działa Multi-Tenant?

### Automatyczne tworzenie przy rejestracji:

```
Użytkownik rejestruje się
    ↓
1. Tworzy się wpis w auth.users (Supabase Auth)
    ↓
2. Trigger tworzy profil w profiles
    ↓
3. Trigger tworzy pierwszą organizację
    ↓
4. Dodaje użytkownika jako 'owner' organizacji
```

### Row Level Security (RLS):

Każde zapytanie automatycznie filtruje dane:
- Użytkownicy widzą tylko swoje organizacje
- Członkowie widzą tylko dane swojej organizacji
- Brak możliwości dostępu do danych innych organizacji

## Co dalej?

### Sprawdź bazę danych w Studio

1. Otwórz: http://127.0.0.1:54323
2. Przejdź do "Table Editor"
3. Zobacz tabele:
   - `profiles` - profil użytkownika
   - `organizations` - organizacje
   - `organization_members` - członkostwa z rolami

### Sprawdź polityki RLS

1. W Studio → "Authentication" → "Policies"
2. Zobacz polityki dla każdej tabeli
3. Każda polityka filtruje dane dla bieżącego użytkownika

### Rozbudowa aplikacji

Możesz dodać:
- Tworzenie nowych organizacji
- Zapraszanie członków (już jest funkcja w `lib/organizations.ts`)
- Zarządzanie rolami
- Tabele specyficzne dla organizacji (np. projekty, zadania)
- Profile użytkowników z awatarami

## Przydatne komendy

```bash
# Status Supabase
supabase status

# Otwórz Studio
open http://127.0.0.1:54323

# Otwórz email testing
open http://127.0.0.1:54324

# Reset bazy (usuwa wszystkie dane!)
supabase db reset

# Zatrzymaj Supabase
supabase stop

# Uruchom Supabase
supabase start
```

## Struktura kodu

```
app/
├── login/              # Logowanie z magic link
├── signup/             # Rejestracja z magic link
├── dashboard/          # Panel użytkownika
├── organizations/[id]/ # Szczegóły organizacji
└── auth/
    ├── callback/       # Callback po kliknięciu linku
    └── signout/        # Wylogowanie

lib/
├── supabase/
│   ├── client.ts       # Client-side Supabase
│   ├── server.ts       # Server-side Supabase
│   └── middleware.ts   # Auth middleware
└── organizations.ts    # Helper functions

supabase/
└── migrations/
    └── 20260325000000_initial_schema.sql  # Cała struktura bazy
```

## Troubleshooting

### Docker nie działa?
```bash
# Sprawdź czy Docker Desktop jest uruchomiony
docker ps

# Restart Supabase
supabase stop
supabase start
```

### Migracje się nie aplikują?
```bash
supabase db reset
```

### Magic link nie działa?
1. Sprawdź Mailpit: http://127.0.0.1:54324
2. Sprawdź czy `NEXT_PUBLIC_SUPABASE_URL` w `.env.local` jest poprawny

---

**Gotowe!** Masz w pełni działający multi-tenant SaaS z magic link auth! 🎉
