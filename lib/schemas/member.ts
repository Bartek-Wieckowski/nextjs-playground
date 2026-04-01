import { z } from 'zod'

export const UpdateMemberStatusSchema = z.object({
  memberId: z.string().uuid(),
  orgId: z.string().uuid(),
  status: z.enum(['active', 'suspended']),
})

export const RemoveMemberSchema = z.object({
  memberId: z.string().uuid(),
  orgId: z.string().uuid(),
})

export const AddMemberSchema = z.object({
  orgId: z.string().uuid('Nieprawidłowe ID organizacji'),
  fullName: z.string().min(1, 'Imię i nazwisko jest wymagane').max(100, 'Imię i nazwisko jest za długie'),
  email: z.string().email('Nieprawidłowy adres email').transform((v) => v.toLowerCase()),
})

export const UpdateMemberSchema = z.object({
  memberId: z.string().uuid('Nieprawidłowe ID członka'),
  orgId: z.string().uuid('Nieprawidłowe ID organizacji'),
  fullName: z.string().min(1, 'Imię i nazwisko jest wymagane').max(100, 'Imię i nazwisko jest za długie'),
  role: z.enum(['admin', 'member']),
  status: z.enum(['active', 'suspended']),
})
