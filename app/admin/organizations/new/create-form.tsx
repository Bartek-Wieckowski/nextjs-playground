'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateOrganizationForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    ownerEmail: '',
    sendInvite: true,
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    
    setFormData({ ...formData, name, slug })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Błąd podczas tworzenia organizacji')
      }

      setMessage({
        type: 'success',
        text: formData.sendInvite
          ? 'Organizacja utworzona! Zaproszenie zostało wysłane.'
          : 'Organizacja utworzona pomyślnie!',
      })

      // Przekieruj po 2 sekundach
      setTimeout(() => {
        router.push(`/admin/organizations/${data.organization.id}`)
      }, 2000)
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Wystąpił błąd',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nazwa organizacji *
        </label>
        <input
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500"
          placeholder="Acme Corporation"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
          Slug (URL-friendly) *
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
            /
          </span>
          <input
            id="slug"
            type="text"
            required
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            className="block w-full rounded-none rounded-r-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-purple-500"
            placeholder="acme-corp"
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="sendInvite"
              type="checkbox"
              checked={formData.sendInvite}
              onChange={(e) => setFormData({ ...formData, sendInvite: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="sendInvite" className="font-medium text-gray-700">
              Wyślij zaproszenie dla właściciela
            </label>
            <p className="text-sm text-gray-500">
              Właściciel otrzyma magic link do dokończenia rejestracji
            </p>
          </div>
        </div>

        {formData.sendInvite && (
          <div className="mt-4">
            <label htmlFor="ownerEmail" className="block text-sm font-medium text-gray-700">
              Email właściciela *
            </label>
            <input
              id="ownerEmail"
              type="email"
              required={formData.sendInvite}
              value={formData.ownerEmail}
              onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500"
              placeholder="owner@example.com"
            />
          </div>
        )}
      </div>

      {message && (
        <div
          className={`rounded-md p-4 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Tworzenie...' : 'Stwórz organizację'}
        </button>
      </div>
    </form>
  )
}
