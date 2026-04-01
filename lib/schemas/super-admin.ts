import { z } from 'zod'

export const BootstrapSchema = z.object({
  bootstrap_token: z.string().min(1, 'Brak tokenu'),
  full_name: z.string().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki').max(100),
})

export const InviteSchema = z.object({
  email: z
    .string()
    .email('Podaj prawidłowy adres email')
    .transform((v) => v.toLowerCase()),
})

export const AcceptInviteSchema = z.object({
  token: z.string().min(1, 'Brak tokenu'),
  full_name: z.string().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki').max(100),
})
