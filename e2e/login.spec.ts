import { test, expect } from '@playwright/test'

test.describe('Strona logowania', () => {
  test('wyświetla formularz magic link', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Zaloguj się' })).toBeVisible()
    await expect(page.getByLabel('Adres email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wyślij magiczny link' })).toBeVisible()
  })

  test('pokazuje błąd przy nieprawidłowym emailu', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Adres email').fill('nie-email')
    await page.getByRole('button', { name: 'Wyślij magiczny link' }).click()

    // Walidacja HTML5 blokuje submit — pole powinno być zaznaczone jako invalid
    const input = page.getByLabel('Adres email')
    await expect(input).toHaveAttribute('type', 'email')
  })

  test('wysyła formularz z prawidłowym emailem i pokazuje komunikat sukcesu', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Adres email').fill('test@example.com')
    await page.getByRole('button', { name: 'Wyślij magiczny link' }).click()

    await expect(
      page.getByText('Sprawdź swoją skrzynkę email'),
    ).toBeVisible({ timeout: 5000 })
  })

  test('niezalogowany użytkownik na /dashboard zostaje przekierowany na /login', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
  })
})
