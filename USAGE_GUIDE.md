# 🚀 Multi-Tenant SaaS - Instrukcja użytkowania

## 📋 Architektura systemu

```
CompanyTheBest (Twoja firma)
    ↓
Super Admins (Pracownicy - pełny dostęp)
    ↓
Organizations (Organizacje klientów)
    ↓
Organization Members (Użytkownicy w organizacjach)
    └── Roles: owner, admin, member, viewer
```

## 🔐 Role w systemie

### 1. Super Admin
- **Kto**: Pracownicy CompanyTheBest
- **Uprawnienia**:
  - Widzi WSZYSTKIE organizacje
  - Może tworzyć organizacje
  - Może wysyłać zaproszenia dla ownerów
  - Może zarządzać wszystkimi użytkownikami
- **Dashboard**: `/admin/dashboard`

### 2. Organization Owner
- **Kto**: Właściciel organizacji klienta
- **Uprawnienia**:
  - Pełne zarządzanie swoją organizacją
  - Może dodawać adminów i członków
  - Może usunąć organizację
- **Dashboard**: `/dashboard`

### 3. Organization Admin
- **Kto**: Administrator w organizacji
- **Uprawnienia**:
  - Może zarządzać członkami
  - Może edytować ustawienia organizacji
  - NIE może usunąć organizacji

### 4. Organization Member / Viewer
- **Kto**: Zwykły użytkownik w organizacji
- **Uprawnienia**:
  - Dostęp do danych organizacji (read-only dla viewer)
  - Podstawowe funkcje aplikacji

## 🎯 Flow rejestracji

### Scenariusz 1: Super Admin (Pracownik CompanyTheBest)

```bash
1. Wejdź na: http://localhost:3000/admin/register?secret=your-super-secret-token-change-in-production

2. Wypełnij formularz:
   - Imię: Jan
   - Nazwisko: Kowalski  
   - Email: jan@companythebest.com
   - Stanowisko: CEO

3. Kliknij "Wyślij magiczny link"

4. Sprawdź email w Inbucket: http://127.0.0.1:54324

5. Kliknij link z emaila

6. ✅ Zostaniesz przekierowany na /admin/dashboard
```

**Ważne**: 
- URL `/admin/register` jest chroniony secret tokenem z `.env.local`
- Token można przekazać przez `?secret=TOKEN` lub cookie
- Po wejściu z poprawnym tokenem, ustawia się cookie na 1h

### Scenariusz 2: Organization Owner (przez zaproszenie)

```bash
# Super Admin wysyła zaproszenie:

1. Super Admin wchodzi na: /admin/organizations/new

2. Wypełnia dane organizacji:
   - Nazwa: Acme Corporation
   - Slug: acme-corp
   - ✅ Wyślij zaproszenie dla właściciela
   - Email właściciela: owner@acme.com

3. Owner otrzymuje email z linkiem typu:
   http://localhost:3000/invite/accept?token=UNIQUE_TOKEN

4. Owner klika w link → widzi zaproszenie

5. Klika "Zaakceptuj zaproszenie"

6. Dostaje magic link na swój email

7. Klika w magic link

8. ✅ Automatycznie zostaje dodany jako Owner organizacji
   → Przekierowanie na /organizations/{id}
```

### Scenariusz 3: Zwykły użytkownik (publiczna rejestracja)

```bash
1. Wejdź na: http://localhost:3000/signup

2. Wypełnij dane:
   - Imię i nazwisko
   - Email

3. Kliknij "Wyślij magiczny link"

4. Sprawdź email → kliknij link

5. ✅ Konto utworzone, ale NIE należysz do żadnej organizacji

6. Czekasz aż Owner/Admin organizacji:
   - Zaprosi Cię do organizacji
   - LUB Super Admin doda Cię ręcznie
```

## 🔒 Zabezpieczenia

### Row Level Security (RLS)

Każda tabela ma polityki RLS:

```sql
-- Przykład: Organizations
-- Super admin widzi wszystkie
-- Członek widzi tylko swoje
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    is_super_admin(auth.uid())  -- Super admin widzi wszystko
    OR
    EXISTS (                      -- Lub należysz do organizacji
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );
```

### Middleware/Proxy

```typescript
// proxy.ts chroni routes:

/admin/*           → Tylko Super Admin
/dashboard         → Zalogowany użytkownik
/organizations/*   → Członek organizacji
/invite/accept     → Publiczny (z tokenem)
```

## 📊 Przykładowe użycie

### Tworzenie organizacji przez Super Admin

```typescript
// W przeglądarce:
// 1. Zaloguj się jako Super Admin
// 2. Wejdź na /admin/dashboard
// 3. Kliknij "+ Stwórz organizację"
// 4. Wypełnij formularz

// API endpoint: POST /api/admin/organizations
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "ownerEmail": "owner@acme.com",
  "sendInvite": true
}
```

### Wysyłanie zaproszenia do organizacji

```typescript
// Owner/Admin organizacji może zaprosić członka

// Funkcja: createInvitation()
await createInvitation(
  'user@example.com',
  'organization_member',
  {
    organizationId: 'org-uuid',
    role: 'member'  // lub 'admin'
  }
)
```

## 🧪 Testowanie

### 1. Reset bazy danych

```bash
supabase db reset
```

### 2. Stwórz pierwszego Super Admina

```bash
# W przeglądarce:
http://localhost:3000/admin/register?secret=your-super-secret-token-change-in-production
```

### 3. Super Admin tworzy organizację

```bash
/admin/dashboard → + Stwórz organizację
```

### 4. Sprawdź zaproszenie w Inbucket

```bash
http://127.0.0.1:54324
```

### 5. Owner loguje się i widzi swoją organizację

```bash
/dashboard → Lista organizacji
```

## 🔍 Sprawdzanie w bazie

```sql
-- Zobacz wszystkich super adminów
SELECT 
  sa.*,
  p.email,
  p.first_name,
  p.last_name
FROM super_admins sa
JOIN profiles p ON p.id = sa.id
WHERE sa.is_active = true;

-- Zobacz organizacje z liczbą członków
SELECT 
  o.name,
  o.slug,
  COUNT(om.id) as member_count
FROM organizations o
LEFT JOIN organization_members om ON om.organization_id = o.id
GROUP BY o.id;

-- Zobacz kto należy do jakiej organizacji
SELECT 
  o.name as organization,
  p.email,
  om.role
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN profiles p ON p.id = om.user_id
ORDER BY o.name, om.role;
```

## ⚠️ Ważne uwagi

1. **Secret token**: Zmień `SUPER_ADMIN_SECRET` w `.env.local` na produkcji!

2. **Izolacja danych**: RLS zapewnia że:
   - Organizacje nie widzą swoich danych nawzajem
   - Tylko Super Admin widzi wszystko
   - Queries są automatycznie filtrowane

3. **Invi tation tokens**: 
   - Są jednorazowe
   - Wygasają po 7 dniach
   - Zawierają context (org_id, role)

4. **Magic Links**:
   - Lokalnie emaile w Inbucket: http://127.0.0.1:54324
   - Produkcyjnie skonfiguruj SMTP w `supabase/config.toml`

## 🚀 Następne kroki

Co można dodać:
- [ ] Bulk invite (zaproszenie wielu osób naraz)
- [ ] Custom email templates
- [ ] Audit log (kto co zmienił)
- [ ] Billing per organization
- [ ] Organization settings & branding
- [ ] Member permissions (fine-grained)
- [ ] API keys per organization

---

✅ **Gotowe!** Masz w pełni działający multi-tenant SaaS z hierarchią ról!
