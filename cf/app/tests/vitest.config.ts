import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    globals: true,
    include: ['tests/integration/**/*.spec.ts'],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2025-06-17',
          // For a static site, we can define some basic environment
          bindings: {
            ENVIRONMENT: 'test',
            API_KEY: 'test-key',
            API_BASE_URL: '/api'
          }
        }
      },
    },
  },
})