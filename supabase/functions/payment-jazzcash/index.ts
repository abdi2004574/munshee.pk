// Supabase Edge Function: payment-jazzcash
// Runtime: Deno
// Purpose: Scaffold for JazzCash sandbox payment integration.
//          Requires JazzCash merchant sandbox credentials to be configured.

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

function redirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const merchantId = Deno.env.get("JAZZCASH_MERCHANT_ID");
  const password = Deno.env.get("JAZZCASH_PASSWORD");
  const sandboxUrl = Deno.env.get("JAZZCASH_SANDBOX_URL");

  if (!merchantId || !password || !sandboxUrl) {
    return jsonResponse(500, {
      error: "JazzCash credentials not configured. Set JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, and JAZZCASH_SANDBOX_URL in Supabase Edge Functions secrets.",
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
      message: "JazzCash callback received. Complete the payment transaction via the complete_payment_transaction RPC after verifying gateway response.",
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
    error: "JazzCash payment initiation not yet implemented. Provide merchant sandbox credentials and implement the payment request payload.",
    plan_id: planId,
  });
});