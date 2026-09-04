// Supabase Edge Function: ask-munshee
// Runtime: Deno
// Purpose: Answer a tenant's business question using only confirmed facts
//          from public.business_facts, via OpenRouter (meta-llama/llama-3.3-70b).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BODY_SCHEMA = z.object({
  tenant_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

const RATE_LIMIT = { maxPerMinute: 30, maxPerHour: 500 };

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type BusinessFactRow = {
  category: string;
  label: string;
  value: string;
};

function buildSystemPrompt(facts: BusinessFactRow[]): string {
  const factLines = facts
    .map((f, i) => `${i + 1}. [${f.category}] ${f.label}: ${f.value}`)
    .join("\n");

  return `You are Munshee.pk's business knowledge assistant. Answer customer questions about the business.

Only answer using the facts provided below. If the answer isn't in these facts, say you don't know rather than guessing.

FACTS:
${factLines}`;
}

async function enforceCredits(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  actionType: string,
): Promise<{ ok: true; balanceAfter: number } | { ok: false; status: number; body: Record<string, unknown> }> {
  const { data: costRow, error: costError } = await supabase
    .from("credit_costs" as never)
    .select("credits")
    .eq("action_type", actionType)
    .maybeSingle();
  if (costError || !costRow) {
    return { ok: false, status: 500, body: { error: "credit_config_missing", message: `No credit cost configured for action: ${actionType}` } };
  }
  const cost = Number((costRow as { credits: number }).credits);

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants" as never)
    .select("credit_balance")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError || !tenantRow) {
    return { ok: false, status: 500, body: { error: "tenant_not_found" } };
  }
  const currentBalance = Number((tenantRow as { credit_balance: number }).credit_balance);

  if (currentBalance < cost) {
    return {
      ok: false,
      status: 402,
      body: {
        error: "out_of_credits",
        message: `You have ${currentBalance} credits, but this action costs ${cost} credits. Please top up your balance.`,
        required: cost,
        available: currentBalance,
      },
    };
  }

  const { data: updatedRows, error: updateError } = await supabase.rpc("deduct_tenant_credits" as never, { p_tenant_id: tenantId, p_amount: cost } as never);
  if (updateError) {
    return { ok: false, status: 500, body: { error: "credit_deduction_failed", message: updateError.message } };
  }
  const newBalance = updatedRows as unknown as number | null;
  if (newBalance === null || newBalance === undefined) {
    return { ok: false, status: 402, body: { error: "out_of_credits", message: "Insufficient credits (concurrent deduction)." } };
  }

  await supabase.from("credit_ledger" as never).insert({
    tenant_id: tenantId,
    action_type: actionType,
    credits_used: cost,
    balance_after: newBalance,
    reference_id: null,
  } as never);

  return { ok: true, balanceAfter: newBalance };
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  functionName: string,
  maxPerMinute: number,
  maxPerHour: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_tenant_id: tenantId,
    p_function_name: functionName,
    p_max_per_minute: maxPerMinute,
    p_max_per_hour: maxPerHour,
  });
  if (error) {
    console.error("Rate limit check failed:", error);
    return true;
  }
  return data as boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let parsedBody: z.infer<typeof BODY_SCHEMA>;
  try {
    const raw = await req.json();
    const result = BODY_SCHEMA.safeParse(raw);
    if (!result.success) {
      return jsonResponse(400, {
        error: "Invalid input",
        details: result.error.flatten().fieldErrors,
      });
    }
    parsedBody = result.data;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing authorization header" });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "Supabase environment not configured",
    });
  }
  const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user } } = await serviceSupabase.auth.getUser(token);
  if (!user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  const tenantId = user.id;

  const rateOk = await checkRateLimit(serviceSupabase, tenantId, "ask-munshee", RATE_LIMIT.maxPerMinute, RATE_LIMIT.maxPerHour);
  if (!rateOk) {
    return jsonResponse(429, {
      error: "rate_limited",
      message: "Too many requests. Please try again later.",
      limit_per_minute: RATE_LIMIT.maxPerMinute,
    });
  }

  const creditResult = await enforceCredits(serviceSupabase, tenantId, "ask_munshee_query");
  if (!creditResult.ok) {
    return jsonResponse(creditResult.status, creditResult.body as Record<string, unknown>);
  }

  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseAnonKey) {
    return jsonResponse(500, {
      error: "Supabase environment not configured",
    });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: facts, error: factsError } = await supabase
    .from("business_facts")
    .select("category,label,value")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (factsError) {
    console.error("Failed to fetch business facts:", factsError);
    return jsonResponse(500, { error: "Failed to fetch business facts" });
  }

  const systemPrompt = buildSystemPrompt(
    (facts as BusinessFactRow[] | null) ?? []
  );

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return jsonResponse(500, { error: "OpenRouter API key not configured" });
  }

  const payload = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: parsedBody.question },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  };

  let openRouterResp: Response;
  try {
    openRouterResp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://munshee.pk",
        "X-Title": "Munshee.pk",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("OpenRouter fetch failed:", err);
    return jsonResponse(500, { error: "Failed to reach OpenRouter" });
  }

  if (!openRouterResp.ok) {
    const errText = await openRouterResp.text().catch(() => "");
    console.error(
      `OpenRouter non-200 (${openRouterResp.status}):`,
      errText.slice(0, 500)
    );
    return jsonResponse(500, { error: "OpenRouter request failed" });
  }

  let completion: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    completion = await openRouterResp.json();
  } catch {
    return jsonResponse(500, { error: "Invalid response from AI model" });
  }

  const answer = completion?.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    return jsonResponse(500, { error: "Invalid response from AI model" });
  }

  const { error: logError } = await supabase.from("ask_logs").insert({
    tenant_id: tenantId,
    question: parsedBody.question,
    answer,
  });

  if (logError) {
    console.error("Failed to log ask Q&A:", logError);
    return jsonResponse(500, { error: "Failed to log conversation" });
  }

  return jsonResponse(200, { answer });
});
