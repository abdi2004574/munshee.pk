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

test.describe('Authentication flow', () => {
  test('signup redirects to dashboard (confirm-email OFF in dev)', async ({ page }) => {
    await requireSupabase();

    const email = `test-auth-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Test Merchant');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('protected route redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('logout redirects to /login', async ({ page }) => {
    await requireSupabase();

    const email = `test-logout-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Logout Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('reload keeps session', async ({ page }) => {
    await requireSupabase();

    const email = `test-reload-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Reload Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/dashboard');
  });

  test('duplicate email shows friendly error', async ({ page }) => {
    await requireSupabase();

    const email = `test-dup-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Dup Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForTimeout(3_000);

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Dup Test 2');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForTimeout(3_000);

    const errorText = await page.getByRole('alert').textContent();
    expect(errorText).toBeTruthy();
    expect(errorText!.toLowerCase()).toMatch(/registred|already|duplicate/);
  });

  test('magic-link callback with invalid code redirects to login', async ({ page }) => {
    await page.goto('/auth/callback?code=invalid-code');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('error=');
  });
});
