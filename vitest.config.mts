import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  /*
   * `tsconfig.json` sets `jsx: preserve`, because Next runs its own JSX
   * transform. Vite has no such downstream step, so a test that imports a
   * component would fail to parse the untransformed JSX. Overriding the
   * transform here rather than editing the tsconfig leaves Next's build alone.
   */
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      // The crypto and parser modules are pure Node; the `server-only` guard
      // has no meaning under Vitest.
      'server-only': resolve(import.meta.dirname, 'src/test/server-only-stub.ts'),
    },
  },
})
