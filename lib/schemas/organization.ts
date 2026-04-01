import { z } from 'zod'

export const CreateOrgSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100, 'Maksymalnie 100 znaków'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, 'Slug może zawierać tylko małe litery, cyfry i myślniki')
    .max(100)
    .optional(),
  description: z.string().max(500, 'Maksymalnie 500 znaków').optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).default('active'),
})

export const UpdateOrgSchema = z.object({
  id: z.string().uuid('Nieprawidłowe ID organizacji'),
  name: z.string().min(1, 'Nazwa jest wymagana').max(100),
  slug: z
    .string()
    .min(1, 'Slug jest wymagany')
    .regex(/^[a-z0-9-]+$/, 'Slug może zawierać tylko małe litery, cyfry i myślniki')
    .max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'suspended', 'cancelled']),
})

export const ApproveRequestSchema = z.object({
  token: z.string().min(1, 'Brak tokenu'),
})

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>
