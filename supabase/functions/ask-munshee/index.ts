// Supabase Edge Function: ask-munshee
// Runtime: Deno
// Purpose: Answer a tenant's business question using only confirmed facts
//          from public.business_facts, via OpenRouter (meta-llama/llama-3.3-70b).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: { tenant_id?: unknown; question?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const tenantId =
    typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
  const question =
    typeof body.question === "string" ? body.question.trim() : "";

  if (!tenantId || !question) {
    return jsonResponse(400, {
      error: "Missing required fields: tenant_id and question",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, {
      error: "Supabase environment not configured",
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
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
      { role: "user", content: question },
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
    question,
    answer,
  });

  if (logError) {
    console.error("Failed to log ask Q&A:", logError);
    return jsonResponse(500, { error: "Failed to log conversation" });
  }

  return jsonResponse(200, { answer });
});
