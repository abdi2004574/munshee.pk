// Supabase Edge Function: extract-facts
// Runtime: Deno
// Purpose: Extract structured business facts from a merchant-supplied website URL
//          by fetching the page, building an LLM context, and calling OpenRouter
//          (meta-llama/llama-3.3-70b).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b";

const SYSTEM_PROMPT = `You extract structured business facts from raw website text of small Pakistani businesses. Output ONLY valid JSON:
{"businessName":"...","facts":[{"category":"...","label":"...","value":"...","confidence":0.0,"quote":"..."}]}
Categories: identity, contact, timings, delivery, payment, policy, product, faq.
NEVER invent facts. Uncertain ? confidence <0.5. Products include PKR prices as written. Handle Urdu and Roman Urdu natively. Max 25 facts.
quote = max 12 words copied verbatim from source text.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BODY_SCHEMA = z.object({ url: z.string().min(1, "URL is required") });

const RATE_LIMIT = { maxPerMinute: 10, maxPerHour: 100 };

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function extractJson(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("No JSON found in model output");
}

async function enforceAction(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  actionType: string,
): Promise<{ ok: true; actionsLeft: number } | { ok: false; status: number; body: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc("consume_action", {
    p_business_id: businessId,
    p_action_type: actionType,
  } as never);

  if (error) {
    return { ok: false, status: 500, body: { error: "action_check_failed", message: error.message } };
  }

  const result = data as { ok: boolean; actions_left: number; subscription_status: string } | null;

  if (!result || !result.ok) {
    return {
      ok: false,
      status: 402,
      body: {
        code: "ACTIONS_EXHAUSTED",
        error: "actions_exhausted",
        message: "Aapke mahine ke Actions khatam ho gaye — agle month dobara milenge, ya Business plan lein.",
        actionsLeft: result?.actions_left ?? 0,
        subscriptionStatus: result?.subscription_status ?? "unknown",
      },
    };
  }

  return { ok: true, actionsLeft: result.actions_left };
}

type Fact = {
  category: string;
  label: string;
  value: string;
  confidence: number;
  quote: string;
};

const VALID_CATEGORIES = new Set([
  "identity",
  "contact",
  "timings",
  "delivery",
  "payment",
  "policy",
  "product",
  "faq",
]);

function validateFact(fact: unknown): Fact | null {
  if (!fact || typeof fact !== "object") return null;
  const f = fact as Record<string, unknown>;

  const category = typeof f.category === "string" ? f.category : "";
  const label = typeof f.label === "string" ? f.label : "";
  const value = typeof f.value === "string" ? f.value : "";
  const confidence = typeof f.confidence === "number" ? f.confidence : -1;
  const quote = typeof f.quote === "string" ? f.quote : "";

  if (!VALID_CATEGORIES.has(category)) return null;
  if (label.length === 0) return null;
  if (value.length === 0) return null;
  if (confidence < 0 || confidence > 1) return null;
  const wordCount = quote.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 12) return null;

  return { category, label, value, confidence, quote };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return jsonResponse(500, { error: "OpenRouter API key not configured" });
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
    return jsonResponse(500, { error: "Supabase environment not configured" });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  const tenantId = user.id;

  const rateOk = await checkRateLimit(supabase, tenantId, "extract-facts", RATE_LIMIT.maxPerMinute, RATE_LIMIT.maxPerHour);
  if (!rateOk) {
    return jsonResponse(429, {
      error: "rate_limited",
      message: "Too many requests. Please try again later.",
      limit_per_minute: RATE_LIMIT.maxPerMinute,
    });
  }

  const actionResult = await enforceAction(supabase, tenantId, "extract_facts");
  if (!actionResult.ok) {
    return jsonResponse(actionResult.status, actionResult.body as Record<string, unknown>);
  }

  const targetUrl = parsedBody.url.trim();
  const hostname = new URL(targetUrl).hostname.toLowerCase();

  if (
    hostname.includes("facebook.com") ||
    hostname.includes("instagram.com")
  ) {
    return jsonResponse(400, {
      error: "social_blocked",
      message: "Facebook aur Instagram ke links abhi support nahi hain — photo upload ya website URL try karein.",
    });
  }

  let html = "";
  let textLen = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const resp = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.ok) {
      html = await resp.text();
      textLen = html.length;
    }

    if (!resp.ok || textLen < 500) {
      const jinaUrl = `https://r.jina.ai/${targetUrl}`;
      const jinaController = new AbortController();
      const jinaTimeoutId = setTimeout(() => jinaController.abort(), 20_000);

      const jinaResp = await fetch(jinaUrl, {
        signal: jinaController.signal,
      });

      clearTimeout(jinaTimeoutId);

      if (jinaResp.ok) {
        html = await jinaResp.text();
        textLen = html.length;
      }
    }
  } catch (err) {
    console.error("Fetch error:", err);
    return jsonResponse(502, { error: "Website tak nahi pohanch sake — dobara koshish karein?" });
  }

  if (!html || textLen === 0) {
    return jsonResponse(502, { error: "Website se kuch nahi mila — photos se try karein" });
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";

  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1] : "";

  const ogTags: Record<string, string> = {};
  const ogRegex = /<meta[^>]+property=["']og:([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  let ogMatch;
  while ((ogMatch = ogRegex.exec(html)) !== null) {
    ogTags[ogMatch[1]] = ogMatch[2];
  }

  const visibleText = stripHtml(html);
  const truncatedText = visibleText.slice(0, 12000);

  let context = `Page Title: ${title}`;
  if (metaDescription) context += `\nMeta Description: ${metaDescription}`;
  if (ogTags.title) context += `\nOG Title: ${ogTags.title}`;
  if (ogTags.description) context += `\nOG Description: ${ogTags.description}`;
  if (ogTags.image) context += `\nOG Image: ${ogTags.image}`;
  if (ogTags.url) context += `\nOG URL: ${ogTags.url}`;
  context += `\n\nPage Content:\n${truncatedText}`;

  let completion: { choices?: Array<{ message?: { content?: string } }> };
  try {
    const openRouterResp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://munshee.pk",
        "X-Title": "Munshee.pk",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!openRouterResp.ok) {
      const errText = await openRouterResp.text().catch(() => "");
      console.error(`OpenRouter non-200 (${openRouterResp.status}):`, errText.slice(0, 500));
      return jsonResponse(502, { error: "AI se data receive karne mein problem hui — dobara koshish karein" });
    }

    completion = await openRouterResp.json();
  } catch (err) {
    console.error("OpenRouter fetch failed:", err);
    return jsonResponse(500, { error: "AI se connect nahi ho pa raha — thodi der baad try karein" });
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    return jsonResponse(502, { error: "AI se data process karne mein problem hui — dobara koshish karein" });
  }

  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch (err) {
    console.error("JSON parse failed:", err, "raw:", content.slice(0, 500));
    return jsonResponse(502, { error: "AI se data process karne mein problem hui — dobara koshish karein" });
  }

  if (!parsed || typeof parsed !== "object") {
    return jsonResponse(502, { error: "AI se data process karne mein problem hui — dobara koshish karein" });
  }

  const root = parsed as Record<string, unknown>;
  const businessName = typeof root.businessName === "string" ? root.businessName : "";
  const rawFacts = Array.isArray(root.facts) ? root.facts : [];

  const validFacts: Fact[] = rawFacts
    .map(validateFact)
    .filter((f): f is Fact => f !== null)
    .slice(0, 25);

  let facts: Fact[];
  let warning: string | undefined;

  if (validFacts.length === 0) {
    facts = [];
    warning = "Website se kuch nahi mila — photos se try karein";
  } else {
    facts = validFacts;
  }

  const factRows = facts.map((fact) => ({
    tenant_id: tenantId,
    category: fact.category,
    label: fact.label,
    value: fact.value,
    confidence: fact.confidence,
    status: "needs_review",
    source_type: "website",
    source_ref: fact.quote,
    linked_table: null,
    linked_row_id: null,
  }));

  if (factRows.length > 0) {
    const { error: factsError } = await supabase
      .from("business_facts")
      .insert(factRows);

    if (factsError) {
      console.error("Failed to insert business_facts:", factsError);
      return jsonResponse(500, { error: "Facts save karne mein problem hui — dobara koshish karein" });
    }
  }

  const { error: ledgerError } = await supabase.from("action_ledger").insert({
    business_id: tenantId,
    actor_type: "system",
    tool_name: "extract_facts",
    input_summary: `url=${targetUrl}, text_len=${textLen}`,
    result_summary: `extracted ${facts.length} facts`,
    status: "success",
    autonomy_level: 0,
    estimated_value_pkr: 0,
    reversible: false,
  });

  if (ledgerError) {
    console.error("action_ledger insert failed:", ledgerError);
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    tenant_id: tenantId,
    fact_id: null,
    actor: tenantId,
    action: "auto_extract",
    old_value: null,
    new_value: {
      url: targetUrl,
      facts_count: facts.length,
      source_type: "website",
    },
  });

  if (auditError) {
    console.error("audit_log insert failed:", auditError);
  }

  return jsonResponse(200, { facts, businessName, warning });
});