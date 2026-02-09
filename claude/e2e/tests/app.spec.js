import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load the app and show navbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.navbar-brand')).toHaveText('Harvest Clone');
  });

  test('should navigate to all pages', async ({ page }) => {
    await page.goto('/');

    await page.click('a[href="/time"]');
    await expect(page.locator('h1')).toHaveText('Time');

    await page.click('a[href="/expenses"]');
    await expect(page.locator('h1')).toHaveText('Expenses');

    await page.click('a[href="/projects"]');
    await expect(page.locator('h1')).toHaveText('Projects');

    await page.click('a[href="/invoices"]');
    await expect(page.locator('h1')).toHaveText('Invoices');

    await page.click('a[href="/settings"]');
    await expect(page.locator('h1')).toHaveText('Settings');
  });
});

test.describe('Settings', () => {
  test('should load and save settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1')).toHaveText('Settings');

    await page.fill('input[type="text"]', '');
    await page.locator('input[type="text"]').first().fill('Test Company');
    await page.click('button:has-text("Save Settings")');

    await page.reload();
    await expect(page.locator('input[type="text"]').first()).toHaveValue('Test Company');
  });
});

test.describe('Manage - Clients', () => {
  test('should create a new client', async ({ page }) => {
    await page.goto('/manage/clients');
    await page.click('button:has-text("New Client")');
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('.modal input[type="text"]').first().fill('Test Client');
    await page.locator('.modal button:has-text("Save")').click();

    await expect(page.locator('text=Test Client')).toBeVisible();
  });

  test('should add a contact to a client', async ({ page }) => {
    await page.goto('/manage/clients');
    await page.click('button:has-text("New Client")');
    await page.locator('.modal input[type="text"]').first().fill('Contact Client');
    await page.locator('.modal button:has-text("Save")').click();

    await page.click('button:has-text("Add Contact")');
    await expect(page.locator('.modal h2')).toHaveText('Add Contact');
    await page.locator('.modal input[type="text"]').first().fill('John');
    await page.locator('.modal input[type="text"]').nth(1).fill('Doe');
    await page.locator('.modal button:has-text("Save")').click();

    await expect(page.locator('text=John Doe')).toBeVisible();
  });
});

test.describe('Manage - Tasks', () => {
  test('should create a new task', async ({ page }) => {
    await page.goto('/manage/tasks');
    await page.click('button:has-text("New Task")');

    await page.locator('.modal input[type="text"]').fill('Development');
    await page.locator('.modal input[type="number"]').fill('150');
    await page.locator('.modal button:has-text("Save")').click();

    await expect(page.locator('text=Development')).toBeVisible();
  });

  test('should archive a task', async ({ page }) => {
    await page.goto('/manage/tasks');
    await page.click('button:has-text("New Task")');
    await page.locator('.modal input[type="text"]').fill('ArchTask');
    await page.locator('.modal input[type="number"]').fill('100');
    await page.locator('.modal button:has-text("Save")').click();

    await page.locator('tr:has-text("ArchTask") button:has-text("Archive")').click();
    // Task should disappear from default view
    await expect(page.locator('tr:has-text("ArchTask")')).not.toBeVisible();

    // Show archived
    await page.locator('input[type="checkbox"]').check();
    await expect(page.locator('tr:has-text("ArchTask")')).toBeVisible();
  });
});

test.describe('Manage - Expense Categories', () => {
  test('should show seeded categories', async ({ page }) => {
    await page.goto('/manage/expense-categories');
    await expect(page.locator('text=Entertainment')).toBeVisible();
    await expect(page.locator('text=Meals')).toBeVisible();
    await expect(page.locator('text=Lodging')).toBeVisible();
  });
});

test.describe('Projects', () => {
  test('should create a project', async ({ page }) => {
    // First create a client and task
    await page.goto('/manage/clients');
    await page.click('button:has-text("New Client")');
    await page.locator('.modal input[type="text"]').first().fill('Project Client');
    await page.locator('.modal button:has-text("Save")').click();

    await page.goto('/manage/tasks');
    await page.click('button:has-text("New Task")');
    await page.locator('.modal input[type="text"]').fill('Coding');
    await page.locator('.modal input[type="number"]').fill('200');
    await page.locator('.modal button:has-text("Save")').click();

    // Now create project
    await page.goto('/projects');
    await page.click('button:has-text("New Project")');
    await page.locator('.modal select').first().selectOption({ label: 'Project Client' });
    await page.locator('.modal input[type="text"]').first().fill('Test Project');
    await page.locator('.modal button:has-text("Save")').click();

    await expect(page.locator('text=Test Project')).toBeVisible();
  });
});

test.describe('Time Tracking', () => {
  test('should show week and day views', async ({ page }) => {
    await page.goto('/time');
    await expect(page.locator('h1')).toHaveText('Time');

    // Week view should be default
    await expect(page.locator('button.active:has-text("Week")')).toBeVisible();

    // Switch to day view
    await page.click('button:has-text("Day")');
    await expect(page.locator('button.active:has-text("Day")')).toBeVisible();
  });

  test('should show fill month form', async ({ page }) => {
    await page.goto('/time');
    await page.click('button:has-text("Fill Month")');
    await expect(page.locator('.fill-month-form')).toBeVisible();
  });
});

test.describe('Reports', () => {
  test('should show invoices report', async ({ page }) => {
    await page.goto('/reports/invoices');
    await expect(page.locator('h2:has-text("Invoices Report")')).toBeVisible();
  });

  test('should show accounts receivable', async ({ page }) => {
    await page.goto('/reports/accounts-receivable');
    await expect(page.locator('h2:has-text("Accounts Receivable")')).toBeVisible();
  });
});
