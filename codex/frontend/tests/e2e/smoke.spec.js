import { test, expect } from '@playwright/test'

test('app shell renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Consulting Tracker')).toBeVisible()
  await page.getByRole('button', { name: 'Manage' }).click()
  await expect(page.getByRole('heading', { name: 'Manage' })).toBeVisible()
})
