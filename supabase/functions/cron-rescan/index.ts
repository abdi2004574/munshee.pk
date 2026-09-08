// Supabase Edge Function: cron-rescan
// Runtime: Deno
// Purpose: External cron trigger for re-scan deltas.
//          Called by UptimeRobot (or any external cron) on a schedule.
//          Protected by X-Cron-Secret header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const cronSecret = Deno.env.get("RESCAN_CRON_SECRET");
  const providedSecret = req.headers.get("X-Cron-Secret");

  if (!cronSecret || providedSecret !== cronSecret) {
    return jsonResponse(401, { error: "Unauthorized cron trigger" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Supabase environment not configured" });
  }

  const sb = createClient(supabaseUrl, serviceRoleKey);

  const { data: dueRescans, error: listError } = await sb.rpc("list_due_rescans", { p_limit: 50 });
  if (listError) {
    console.error("list_due_rescans failed:", listError);
    return jsonResponse(500, { error: listError.message });
  }

  const results = [];
  for (const row of (dueRescans ?? [])) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/re-scan-business`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await resp.json();
      results.push({
        business_id: row.business_id,
        cadence: row.cadence,
        status: resp.ok ? "success" : "failed",
        details: result,
      });
    } catch (err) {
      console.error(`rescan failed for ${row.business_id}:`, err);
      results.push({
        business_id: row.business_id,
        cadence: row.cadence,
        status: "error",
        details: { message: String(err) },
      });
    }
  }

  return jsonResponse(200, { processed: results.length, results });
});
