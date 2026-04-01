import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/organizations'

describe('generateSlug', () => {
  it('zamienia spacje na myślniki', () => {
    expect(generateSlug('Acme Corp')).toBe('acme-corp')
  })

  it('zamienia litery na małe', () => {
    expect(generateSlug('ACME')).toBe('acme')
  })

  it('usuwa polskie znaki diakrytyczne', () => {
    expect(generateSlug('Żółta Łódź')).toBe('zolta-lodz')
    expect(generateSlug('Ślązak i Ółówek')).toBe('slazak-i-olowek')
  })

  it('usuwa znaki specjalne', () => {
    expect(generateSlug('Acme & Co.')).toBe('acme-and-co')
    expect(generateSlug('Hello! World?')).toBe('hello-world')
  })

  it('spłaszcza wielokrotne myślniki do jednego', () => {
    expect(generateSlug('Acme   Corp')).toBe('acme-corp')
    expect(generateSlug('A -- B')).toBe('a-b')
  })

  it('usuwa białe znaki z początku i końca', () => {
    expect(generateSlug('  Acme  ')).toBe('acme')
  })

  it('obsługuje pusty string', () => {
    expect(generateSlug('')).toBe('')
  })
})
