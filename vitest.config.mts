import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      // The crypto and parser modules are pure Node; the `server-only` guard
      // has no meaning under Vitest.
      'server-only': resolve(import.meta.dirname, 'src/test/server-only-stub.ts'),
    },
  },
})
