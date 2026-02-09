import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

vi.stubGlobal('fetch', vi.fn(async (url) => {
  if (String(url).includes('/api/bootstrap')) {
    return { ok: true, json: async () => ({ clients: [], contacts: [], projects: [], tasks: [], project_tasks: [], categories: [], settings: {} }) }
  }
  return { ok: true, json: async () => [] }
}))

describe('App', () => {
  test('renders primary navigation', async () => {
    render(<App />)
    expect(await screen.findByText('Consulting Tracker')).toBeDefined()
    expect(screen.getByText('Time')).toBeDefined()
    expect(screen.getByText('Invoices')).toBeDefined()
  })
})
