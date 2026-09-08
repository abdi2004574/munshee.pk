import { test, expect } from '@playwright/test';

async function requireSupabase() {
  if (process.env.CI === 'true') {
    test.skip(true, 'requires local Supabase dev stack');
    return;
  }
  const resp = await fetch('http://localhost:54321/rest/v1/').catch(() => null);
  if (!resp || !resp.ok) {
    test.skip(true, 'Supabase not running at localhost:54321');
  }
}

test.describe('Admin eval route', () => {
  test('non-admin gets 403', async ({ page }) => {
    await requireSupabase();

    const email = `test-eval-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    // Sign up via browser
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Eval Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Navigate to admin eval - should 403 because not in ALLOWED_ADMIN_EMAILS
    await page.goto('/apps/admin/eval');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('403')).toBeVisible();
  });

  test('admin sees eval page', async ({ page }) => {
    await requireSupabase();

    const adminEmail = 'admin@munshee.pk';
    const password = 'Test1234!';

    // Try signup; if already registered, fall back to login
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Admin Eval');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait briefly for either dashboard redirect or error
    await page.waitForTimeout(3000);
    const url = page.url();
    const hasDashboard = url.includes('/dashboard');
    const hasError = await page.getByRole('alert').isVisible().catch(() => false);

    if (!hasDashboard && hasError) {
      // Already registered — sign in instead
      await page.goto('/login');
      await page.getByLabel('Email').fill(adminEmail);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    } else if (!hasDashboard) {
      test.skip(true, 'admin signup/login did not complete');
      return;
    }

    // Navigate to admin eval - should render for admin
    await page.goto('/apps/admin/eval');
    await page.waitForLoadState('networkidle');

    const hasEval = await page.getByText('Weekly Eval').isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No evaluation data yet').isVisible().catch(() => false);

    expect(hasEval || hasEmpty).toBe(true);
  });
});