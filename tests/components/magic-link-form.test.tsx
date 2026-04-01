import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockSignInWithOtp = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
    },
  }),
}))

// useSearchParams wymaga Suspense — mockujemy żeby uniknąć błędu w jsdom
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}))

// ── Testy ─────────────────────────────────────────────────────────────────────

import { MagicLinkForm } from '@/app/login/magic-link-form'

describe('MagicLinkForm', () => {
  beforeEach(() => {
    mockSignInWithOtp.mockReset()
  })

  it('renderuje pole email i przycisk', () => {
    render(<MagicLinkForm />)

    expect(screen.getByLabelText('Adres email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij magiczny link' })).toBeInTheDocument()
  })

  it('pokazuje komunikat sukcesu po wysłaniu', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })

    render(<MagicLinkForm />)

    await userEvent.type(screen.getByLabelText('Adres email'), 'test@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij magiczny link' }))

    await waitFor(() => {
      expect(screen.getByText(/Sprawdź swoją skrzynkę email/)).toBeInTheDocument()
    })
  })

  it('pokazuje błąd gdy Supabase zwróci error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: new Error('rate limit') })

    render(<MagicLinkForm />)

    await userEvent.type(screen.getByLabelText('Adres email'), 'test@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij magiczny link' }))

    await waitFor(() => {
      expect(screen.getByText(/Wystąpił błąd/)).toBeInTheDocument()
    })
  })

  it('blokuje przycisk podczas wysyłania', async () => {
    // Nigdy się nie rozwiązuje — symuluje loading state
    mockSignInWithOtp.mockImplementation(() => new Promise(() => {}))

    render(<MagicLinkForm />)

    await userEvent.type(screen.getByLabelText('Adres email'), 'test@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij magiczny link' }))

    expect(screen.getByRole('button', { name: 'Wysyłanie...' })).toBeDisabled()
  })
})
