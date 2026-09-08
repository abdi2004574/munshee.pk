import { test, expect } from '@playwright/test';

const isCI = process.env.CI === 'true';

test.describe('Authentication flow', () => {
  test('signup redirects to dashboard (confirm-email OFF in dev)', async ({ page }) => {
    test.skip(isCI, 'requires local Supabase dev stack');

    const email = `test-auth-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Test Merchant');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    // With confirm-email OFF, Supabase returns a session and redirects to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('protected route redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('logout redirects to /login', async ({ page }) => {
    test.skip(isCI, 'requires local Supabase dev stack');

    const email = `test-logout-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    // Sign up
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Logout Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Logout
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('reload keeps session', async ({ page }) => {
    test.skip(isCI, 'requires local Supabase dev stack');

    const email = `test-reload-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    // Sign up
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Reload Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/dashboard');
  });

  test('duplicate email shows friendly error', async ({ page }) => {
    test.skip(isCI, 'requires local Supabase dev stack');

    const email = `test-dup-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    // First signup
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Dup Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForTimeout(3_000);

    // Second signup with same email
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Dup Test 2');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForTimeout(3_000);

    // Should show friendly error (not raw Supabase error)
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
