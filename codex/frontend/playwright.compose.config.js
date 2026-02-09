import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://frontend:3030',
    headless: true
  },
  workers: 1
})
