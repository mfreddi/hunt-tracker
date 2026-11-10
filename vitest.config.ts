import { defineConfig } from 'vitest/config'

// Unit tests for the main-process logic that cannot be exercised by hand on a
// dev machine (the Hunt tracker needs Windows + the game running).
export default defineConfig({
  test: {
    include: ['src/main/**/*.test.ts'],
    environment: 'node'
  }
})
