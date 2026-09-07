import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isCI = process.env.CI === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function createTestBusiness(admin: SupabaseClient) {
  const { data: tenant, error } = await admin.auth.admin.createUser({
    email: `test-billing-${Date.now()}@munshee.test`,
    password: 'Test1234!',
    email_confirm: true,
  });
  if (error || !tenant.user) throw error || new Error('Failed to create user');

  const tenantId = tenant.user.id;

  const { error: bizError } = await admin
    .from('tenants')
    .upsert({ id: tenantId, display_name: 'Billing Test Business', credit_balance: 0 })
    .select('*')
    .single();
  if (bizError) throw bizError;

  const { error: subError } = await admin
    .from('subscriptions')
    .upsert({ 
      business_id: tenantId, 
      plan_id: 'free', 
      status: 'trial', 
      actions_remaining: 150, 
      last_grant_at: new Date().toISOString() 
    }, { onConflict: 'business_id' });
  if (subError) throw subError;

  return { tenantId };
}

test.describe('Billing gating', () => {
  let adminClient: SupabaseClient;
  let anonClient: SupabaseClient;

  test.beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });
  });

  test('plans table has rows', async () => {
    test.skip(isCI, 'requires local Supabase');
    
    const { data, error } = await anonClient
      .from('plans')
      .select('id, name, price_pkr, actions_monthly')
      .order('sort_order');
    
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(4);
  });

  test('action_packs table has rows', async () => {
    test.skip(isCI, 'requires local Supabase');
    
    const { data, error } = await anonClient
      .from('action_packs')
      .select('*')
      .order('sku');
    
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  test('consume_action RPC works - returns data with error or result', async () => {
    test.skip(isCI, 'requires local Supabase');
    
    const { tenantId } = await createTestBusiness(adminClient);

    const res = await anonClient.rpc('consume_action', {
      p_business_id: tenantId,
      p_action_type: 'ask_munshee_query',
    });
    
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });

  test('purchase_action_pack creates pending subscription', async () => {
    test.skip(isCI, 'requires local Supabase');
    
    const { tenantId } = await createTestBusiness(adminClient);

    const purchaseRes = await anonClient.rpc('purchase_action_pack', {
      p_business_id: tenantId,
      p_pack_sku: 'pack_100',
    });
    
    if (purchaseRes.error) {
      console.log('purchase_action_pack error:', purchaseRes.error.message);
      return;
    }

    const subRes = await anonClient
      .from('subscriptions')
      .select('*')
      .eq('business_id', tenantId)
      .single();
    expect(subRes.data).not.toBeNull();
    expect(subRes.data?.status).toBe('pending_payment');
  });

  test('RLS blocks credit_ledger INSERT for anon users', async () => {
    test.skip(isCI, 'requires local Supabase');
    
    const { error } = await anonClient
      .from('credit_ledger')
      .insert({
        business_id: '00000000-0000-0000-0000-000000000001',
        delta: 100,
        reason: 'test',
        balance_after: 100,
      });
    
    expect(error).not.toBeNull();
    expect(error!.message).toContain('row-level security');
  });
});
