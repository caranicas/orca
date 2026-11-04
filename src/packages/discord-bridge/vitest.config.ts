import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { conditions: ['orca-source'] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 2
  }
})
