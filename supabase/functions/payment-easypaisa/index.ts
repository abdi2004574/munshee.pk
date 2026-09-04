// Supabase Edge Function: payment-easypaisa
// Runtime: Deno
// Purpose: Scaffold for Easypaisa sandbox payment integration.
//          Requires Easypaisa merchant sandbox credentials to be configured.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

  const storeId = Deno.env.get("EASYPAISA_STORE_ID");
  const hashKey = Deno.env.get("EASYPAISA_HASH_KEY");
  const sandboxUrl = Deno.env.get("EASYPAISA_SANDBOX_URL");

  if (!storeId || !hashKey || !sandboxUrl) {
    return jsonResponse(500, {
      error: "Easypaisa credentials not configured. Set EASYPAISA_STORE_ID, EASYPAISA_HASH_KEY, and EASYPAISA_SANDBOX_URL in Supabase Edge Functions secrets.",
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const transactionId = url.searchParams.get("transaction_id");
    const status = url.searchParams.get("status");

    if (!transactionId) {
      return jsonResponse(400, { error: "Missing transaction_id" });
    }

    return jsonResponse(200, {
      scaffold: true,
      message: "Easypaisa callback received. Complete the payment transaction via the complete_payment_transaction RPC after verifying gateway response.",
      transaction_id: transactionId,
      gateway_status: status,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: { plan_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";
  if (!planId) {
    return jsonResponse(400, { error: "Missing plan_id" });
  }

  return jsonResponse(501, {
    scaffold: true,
    error: "Easypaisa payment initiation not yet implemented. Provide merchant sandbox credentials and implement the payment request payload.",
    plan_id: planId,
  });
});