import { it, expect } from 'vitest'
import { env } from 'cloudflare:test'

it('environment variables are available', () => {
  expect(env.ENVIRONMENT).toBe('test')
  expect(env.API_KEY).toBe('test-key')
  expect(env.API_BASE_URL).toBe('/api')
})

it('basic functionality works', () => {
  expect(1 + 1).toBe(2)
})