import { defineConfig } from 'vitest/config'

// Security-rules tests run against the Firebase emulators (see `npm run test:rules`).
// Kept separate from vite.config.ts, whose test config is jsdom + src/** only.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
