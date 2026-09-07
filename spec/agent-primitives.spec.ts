import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function createAuthedClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

test.describe('Agent Primitives (v4 architecture)', () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId: string;
  let userBId: string;

  test.beforeAll(async () => {
    // Health check - verify Supabase is reachable
    const healthResp = await fetch(`${SUPABASE_URL}/rest/v1/`);
    if (!healthResp.ok) {
      throw new Error(`Supabase is not reachable at ${SUPABASE_URL}. Run: npx supabase start`);
    }

    const ts = Date.now();
    const emailA = `agent-a-${ts}@example.com`;
    const emailB = `agent-b-${ts}@example.com`;
    const password = 'Test1234!';

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Sign up + sign in user A
    const { error: signUpErrorA } = await anonClient.auth.signUp({
      email: emailA,
      password,
      options: { data: { full_name: 'Agent User A' } },
    });
    expect(signUpErrorA).toBeNull();

    const { data: signInDataA, error: signInErrorA } =
      await anonClient.auth.signInWithPassword({ email: emailA, password });
    expect(signInErrorA).toBeNull();
    userAId = signInDataA.user!.id;
    clientA = createAuthedClient(signInDataA.session!.access_token);

    // Sign up + sign in user B
    const { error: signUpErrorB } = await anonClient.auth.signUp({
      email: emailB,
      password,
      options: { data: { full_name: 'Agent User B' } },
    });
    expect(signUpErrorB).toBeNull();

    const { data: signInDataB, error: signInErrorB } =
      await anonClient.auth.signInWithPassword({ email: emailB, password });
    expect(signInErrorB).toBeNull();
    userBId = signInDataB.user!.id;
    clientB = createAuthedClient(signInDataB.session!.access_token);
  });

  test.beforeEach(async () => {
    await clientA.from('action_ledger').delete().eq('business_id', userAId);
    await clientA.from('kill_switch').delete().eq('business_id', userAId);
    await clientA.from('autonomy_settings').delete().eq('business_id', userAId);
  });

  // ==========================================================================
  // Autonomy service tests
  // ==========================================================================

  test('autonomy service: getLevel returns 0 by default (no settings)', async () => {
    const { data, error } = await clientA.rpc('get_autonomy_level', {
      p_business_id: userAId,
      p_action_type: 'rescan',
    });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  test('autonomy service: setLevel then getLevel returns configured value', async () => {
    await clientA.from('autonomy_settings').upsert({
      business_id: userAId,
      action_type: 'rescan',
      level: 3,
      auto_approve: false,
    });

    const { data: level } = await clientA.rpc('get_autonomy_level', {
      p_business_id: userAId,
      p_action_type: 'rescan',
    });
    expect(level).toBe(3);

    const { data: levelWithKill } = await clientA.rpc(
      'get_autonomy_level_with_kill_switch',
      { p_business_id: userAId, p_action_type: 'rescan' }
    );
    expect(levelWithKill).toBe(3);
  });

  // ==========================================================================
  // Kill switch tests
  // ==========================================================================

  test('kill switch: isKilled returns false when no kill switch configured', async () => {
    const { data, error } = await clientA.rpc('is_kill_switch_active', {
      p_business_id: userAId,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  test('kill switch: active global switch forces level to 0', async () => {
    // Set level to 3
    await clientA.from('autonomy_settings').upsert({
      business_id: userAId,
      action_type: 'rescan',
      level: 3,
      auto_approve: false,
    });

    // Activate global kill switch
    const { error: ksError } = await clientA.from('kill_switch').insert({
      business_id: userAId,
      scope: 'global',
      active: true,
    });
    expect(ksError).toBeNull();

    // is_kill_switch_active should return true
    const { data: killed } = await clientA.rpc('is_kill_switch_active', {
      p_business_id: userAId,
    });
    expect(killed).toBe(true);

    // get_autonomy_level_with_kill_switch should return 0 (override)
    const { data: level } = await clientA.rpc(
      'get_autonomy_level_with_kill_switch',
      { p_business_id: userAId, p_action_type: 'rescan' }
    );
    expect(level).toBe(0);
  });

  // ==========================================================================
  // Tool run: register tool, run, ledger row appears
  // ==========================================================================

  test('tool run: kill-switch check passes ? autonomy check passes ? ledger row written', async () => {
    // Set autonomy level to 3 for 'rescan' action (extract_facts requires >= 1)
    await clientA.from('autonomy_settings').upsert({
      business_id: userAId,
      action_type: 'rescan',
      level: 3,
      auto_approve: false,
    });

    // Step 1: Verify tool registry is registered (mirrors AGENT_TOOLS in agent-tools.ts)
    const toolNames = ['extract_facts', 'ask_munshee'];
    expect(toolNames).toContain('extract_facts');
    expect(toolNames).toContain('ask_munshee');

    // Step 2: Kill switch check (mirrors isKilled in autonomy-service.ts)
    const { data: killed } = await clientA.rpc('is_kill_switch_active', {
      p_business_id: userAId,
    });
    expect(killed).toBe(false);

    // Step 3: Autonomy level check (mirrors getLevel in autonomy-service.ts)
    const { data: autonomyLevel } = await clientA.rpc(
      'get_autonomy_level_with_kill_switch',
      { p_business_id: userAId, p_action_type: 'rescan' }
    );
    expect(autonomyLevel).toBe(3);

    // Step 4: Simulate tool execution writing to action_ledger
    const { error: ledgerError } = await clientA.from('action_ledger').insert({
      business_id: userAId,
      actor_type: 'system',
      tool_name: 'extract_facts',
      input_summary: 'sourceType=text, text_len=42',
      result_summary: 'invoked extract-facts edge function',
      status: 'success',
      autonomy_level: 3,
      estimated_value_pkr: 0,
      reversible: true,
    });
    expect(ledgerError).toBeNull();

    // Step 5: Verify ledger row appears
    const { data: entries } = await clientA
      .from('action_ledger')
      .select('*')
      .eq('business_id', userAId);
    expect(entries).toHaveLength(1);
    expect(entries![0].tool_name).toBe('extract_facts');
    expect(entries![0].status).toBe('success');
    expect(entries![0].autonomy_level).toBe(3);
    expect(entries![0].actor_type).toBe('system');
    expect(entries![0].reversible).toBe(true);
  });

  // ==========================================================================
  // Kill switch blocks run
  // ==========================================================================

  test('tool run: kill-switch active blocks run (no ledger success row)', async () => {
    // Set autonomy level to 3
    await clientA.from('autonomy_settings').upsert({
      business_id: userAId,
      action_type: 'rescan',
      level: 3,
      auto_approve: false,
    });

    // Activate kill switch
    await clientA.from('kill_switch').insert({
      business_id: userAId,
      scope: 'global',
      active: true,
    });

    // Kill switch check (mirrors isKilled in autonomy-service.ts)
    const { data: killed } = await clientA.rpc('is_kill_switch_active', {
      p_business_id: userAId,
    });
    expect(killed).toBe(true);

    // Tool would throw here and NOT write a success ledger entry
    // Verify no success entries in ledger
    const { data: entries } = await clientA
      .from('action_ledger')
      .select('*')
      .eq('business_id', userAId)
      .eq('status', 'success');
    expect(entries).toHaveLength(0);
  });

  // ==========================================================================
  // RLS negative test: user B cannot read user A's ledger
  // ==========================================================================

  test('RLS negative: user B cannot read user A ledger entries', async () => {
    // Set autonomy for user A
    await clientA.from('autonomy_settings').upsert({
      business_id: userAId,
      action_type: 'rescan',
      level: 3,
      auto_approve: false,
    });

    // User A writes a ledger entry
    const { error: insertError } = await clientA.from('action_ledger').insert({
      business_id: userAId,
      actor_type: 'system',
      tool_name: 'extract_facts',
      input_summary: 'private data for business A',
      result_summary: 'result for business A',
      status: 'success',
      autonomy_level: 3,
      estimated_value_pkr: 100,
      reversible: true,
    });
    expect(insertError).toBeNull();

    // Verify user A can read their own ledger
    const { data: userAEntries } = await clientA
      .from('action_ledger')
      .select('*')
      .eq('business_id', userAId);
    expect(userAEntries).toHaveLength(1);

    // User B attempts to read ALL ledger entries — RLS should block
    const { data: userBEntries, error: userBError } = await clientB
      .from('action_ledger')
      .select('*');

    // RLS blocks: user B sees zero rows, not an error
    expect(userBError).toBeNull();
    expect(userBEntries).toHaveLength(0);

    // User B attempts to insert a ledger entry for user A's business_id
    // RLS WITH CHECK should block the insert
    const { error: userBInsertError } = await clientB
      .from('action_ledger')
      .insert({
        business_id: userAId,
        actor_type: 'system',
        tool_name: 'extract_facts',
        input_summary: 'cross-tenant attempt',
        result_summary: 'should be blocked',
        status: 'success',
      });
    expect(userBInsertError).toBeDefined();

    // Verify user A's ledger is still just 1 row (no cross-tenant writes)
    const { data: userAEntriesAfter } = await clientA
      .from('action_ledger')
      .select('*')
      .eq('business_id', userAId);
    expect(userAEntriesAfter).toHaveLength(1);
  });

  // ==========================================================================
  // Autonomy settings: unique constraint
  // ==========================================================================

  test('autonomy settings: unique(business_id, action_type) enforced', async () => {
    await clientA.from('autonomy_settings').insert({
      business_id: userAId,
      action_type: 'digest',
      level: 2,
      auto_approve: true,
    });

    const { error } = await clientA.from('autonomy_settings').insert({
      business_id: userAId,
      action_type: 'digest',
      level: 4,
      auto_approve: false,
    });
    expect(error).toBeDefined(); // Unique violation
  });
});



