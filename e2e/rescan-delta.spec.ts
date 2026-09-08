import { test, expect, type Page } from '@playwright/test';
import express from 'express';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

let fixtureServer: express.Express | null = null;
let fixturePort = 0;

function startFixtureServer(): number {
  const app = express();
  fixturePort = Math.floor(Math.random() * 10000) + 4000;

  app.get('/site-v1', (req, res) => {
    res.send(`
      <html>
        <head><title>Test Business V1</title></head>
        <body>
          <h1>Test Business</h1>
          <p>Call us at 0300-1234567</p>
          <p>Open 9am to 5pm</p>
          <p>Price: Rs 500</p>
        </body>
      </html>
    `);
  });

  app.get('/site-v2', (req, res) => {
    res.send(`
      <html>
        <head><title>Test Business V2</title></head>
        <body>
          <h1>Test Business Updated</h1>
          <p>Call us at 0300-9876543</p>
          <p>Open 8am to 8pm</p>
          <p>Price: Rs 750</p>
          <p>New product launched!</p>
        </body>
      </html>
    `);
  });

  const server = app.listen(fixturePort);
  fixtureServer = app;
  return fixturePort;
}

function stopFixtureServer() {
  if (fixtureServer) {
    // Express cleanup handled by test framework
  }
}

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

async function signupAndLogin(page: Page, email: string, password: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Rescan Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function getAuthHeader(page: Page): Promise<string> {
  const session = await page.evaluate(() => {
    // Access the global supabase client if available, otherwise return empty
    return (window as any).__SUPABASE_SESSION__?.access_token || '';
  });
  return `Bearer ${session}`;
}

test.describe('Re-scan delta detection', () => {
  test.beforeAll(() => {
    startFixtureServer();
  });

  test.afterAll(() => {
    stopFixtureServer();
  });

  test.beforeEach(async ({ page }) => {
    await requireSupabase();
  });

  test('delta flow: changed facts, new facts, removed facts, ledger rows, banner', async ({ page }) => {
    const email = `test-rescan-${Date.now()}@munshee.test`;
    const password = 'Test1234!';

    await signupAndLogin(page, email, password);

    // Extract auth token from page
    const authHeader = await getAuthHeader(page);

    // First re-scan against V1 fixture
    const v1Url = `http://localhost:${fixturePort}/site-v1`;
    const rescanResp1 = await page.evaluate(async (args) => {
      const [url, auth] = args;
      const resp = await fetch('/functions/v1/re-scan-business', {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      return resp.json();
    }, [v1Url, authHeader]);

    expect(rescanResp1).toBeDefined();
    expect(rescanResp1.delta).toBeDefined();

    // Wait for DB write
    await page.waitForTimeout(2000);

    // Verify needs_review facts exist
    const factsAfterV1 = await page.evaluate(async () => {
      const resp = await fetch('/rest/v1/business_facts?status=eq.needs_review&deleted_at=is.null', {
        headers: { 'apikey': (window as any).__SUPABASE_ANON_KEY__ || '' },
      });
      return resp.json();
    });

    expect(Array.isArray(factsAfterV1)).toBe(true);
    expect((factsAfterV1 as any[]).length).toBeGreaterThan(0);

    // Confirm first 2 facts
    const confirmedIds = (factsAfterV1 as any[]).slice(0, 2).map((f: any) => f.id);
    await page.evaluate(async (ids) => {
      for (const id of ids) {
        await fetch('/rest/v1/business_facts?id=eq.' + id, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': (window as any).__SUPABASE_ANON_KEY__ || '',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ status: 'confirmed' }),
        });
      }
    }, confirmedIds);

    // Second re-scan against V2 fixture (changed content)
    const v2Url = `http://localhost:${fixturePort}/site-v2`;
    const rescanResp2 = await page.evaluate(async (args) => {
      const [url, auth] = args;
      const resp = await fetch('/functions/v1/re-scan-business', {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      return resp.json();
    }, [v2Url, authHeader]);

    expect(rescanResp2).toBeDefined();
    expect(rescanResp2.delta).toBeDefined();

    // Verify delta counts
    expect(rescanResp2.delta.changed).toBeGreaterThan(0);
    expect(rescanResp2.delta.added).toBeGreaterThan(0);
    expect(rescanResp2.delta.removed).toBeGreaterThan(0);

    // Verify action_ledger rows
    await page.waitForTimeout(1000);
    const ledgerRows = await page.evaluate(async () => {
      const resp = await fetch('/rest/v1/action_ledger?tool_name=eq.re_scan_business', {
        headers: { 'apikey': (window as any).__SUPABASE_ANON_KEY__ || '' },
      });
      return resp.json();
    });

    expect(Array.isArray(ledgerRows)).toBe(true);
    expect((ledgerRows as any[]).length).toBeGreaterThanOrEqual(2);
    const latestLedger = (ledgerRows as any[])[(ledgerRows as any[]).length - 1];
    expect(latestLedger.reversible).toBe(true);
    expect(latestLedger.tool_name).toBe('re_scan_business');

    // Verify possibly_removed facts
    const possiblyRemoved = await page.evaluate(async () => {
      const resp = await fetch('/rest/v1/business_facts?status=eq.possibly_removed', {
        headers: { 'apikey': (window as any).__SUPABASE_ANON_KEY__ || '' },
      });
      return resp.json();
    });

    expect(Array.isArray(possiblyRemoved)).toBe(true);
    expect((possiblyRemoved as any[]).length).toBeGreaterThan(0);

    // Navigate to review page and check banner
    await page.goto('/apps/review');
    await page.waitForLoadState('networkidle');

    // Banner should show
    const banner = page.locator('text=/cheezein badli hain/');
    await expect(banner).toBeVisible({ timeout: 10000 });
  });
});
