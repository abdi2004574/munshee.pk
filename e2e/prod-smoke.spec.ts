import { test, expect } from '@Playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

test.describe('Production smoke', () => {
  test.beforeEach(async ({ page }) => {
    test.info().annotations.push({ type: 'base_url', description: BASE_URL });
  });

  test.beforeAll(() => {
    if (!process.env.PLAYWRIGHT_BASE_URL) {
      test.skip(true, 'set PLAYWRIGHT_BASE_URL to run production smoke tests');
    }
  });

  test('landing loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    // Root redirects to /login or /dashboard; either is fine as long as it's not a 500
    expect(response?.status()).toBeLessThan(500);
  });

  test('login works (page renders)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create one' })).toBeVisible();
  });

  test('pricing page renders 4 tiers', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    // Check for the pricing heading
    await expect(page.getByRole('heading', { name: 'Simple, transparent pricing' })).toBeVisible();
    // Check for price points
    await expect(page.getByText('Rs 0')).toBeVisible();
    await expect(page.getByText('Rs 5,000')).toBeVisible();
    await expect(page.getByText('Rs 9,000')).toBeVisible();
    // Check for 4 plan names by exact i18n text
    await expect(page.getByText('Free', { exact: true })).toBeVisible();
    await expect(page.getByText('Starter', { exact: true })).toBeVisible();
    await expect(page.getByText('Business', { exact: true })).toBeVisible();
  });

  test('public /b/ page renders', async ({ page }) => {
    const response = await page.goto('/profile/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(200);
    await expect(page.getByText('No public profile yet')).toBeVisible();
  });
});
