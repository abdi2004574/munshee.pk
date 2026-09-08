// Supabase Edge Function: extract-vision
// Runtime: Deno
// Purpose: Extract structured business facts from a photo by calling OpenRouter
//          (qwen/qwen-2.5-vl-72b-instruct).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "qwen/qwen-2.5-vl-72b-instruct";

const SYSTEM_PROMPT = `You extract structured business facts from images of small Pakistani businesses. Output ONLY valid JSON:
{"businessName":"...","facts":[{"category":"...","label":"...","value":"...","confidence":0.0,"quote":"..."}]}
Categories allowed: identity, contact, timings, delivery, payment, policy, product, faq. NEVER invent facts — only what is explicitly visible in the image. Uncertain → confidence below 0.5. Products include PKR prices exactly as written. Handle Urdu and Roman Urdu natively. Max 25 facts.
quote = max 12 words copied verbatim from the image text.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BODY_SCHEMA = z.object({
  image_url: z.string().url().optional(),
  image_base64: z.string().min(1).optional(),
}).refine((data) => {
  const hasUrl = !!data.image_url;
  const hasBase64 = !!data.image_base64;
  return hasUrl !== hasBase64;
}, {
  message: "Exactly one of image_url or image_base64 must be provided",
});

const RATE_LIMIT = { maxPerMinute: 10, maxPerHour: 100 };

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function detectMimeAndBuildDataUrl(raw: string): string {
  if (raw.startsWith("data:")) {
    return raw;
  }
  const head = raw.slice(0, 12);
  if (head.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${raw}`;
  }
  if (head.startsWith("iVBORw0KGgo")) {
    return `data:image/png;base64,${raw}`;
  }
  return `data:image/png;base64,${raw}`;
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

  let imageUrl = "";
  if (parsedBody.image_url) {
    imageUrl = parsedBody.image_url;
  } else if (parsedBody.image_base64) {
    imageUrl = detectMimeAndBuildDataUrl(parsedBody.image_base64);
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

  const rateOk = await checkRateLimit(supabase, tenantId, "extract-vision", RATE_LIMIT.maxPerMinute, RATE_LIMIT.maxPerHour);
  if (!rateOk) {
    return jsonResponse(429, {
      error: "rate_limited",
      message: "Too many requests. Please try again later.",
      limit_per_minute: RATE_LIMIT.maxPerMinute,
    });
  }

  const actionResult = await enforceAction(supabase, tenantId, "vision_extraction");
  if (!actionResult.ok) {
    return jsonResponse(actionResult.status, actionResult.body as Record<string, unknown>);
  }

  const payload = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all business facts visible in this image.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 2000,
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
    return jsonResponse(500, { error: "AI se connect nahi ho pa raha — thodi der baad try karein" });
  }

  if (!openRouterResp.ok) {
    const errText = await openRouterResp.text().catch(() => "");
    console.error(
      `OpenRouter non-200 (${openRouterResp.status}):`,
      errText.slice(0, 500)
    );
    return jsonResponse(502, { error: "AI se data receive karne mein problem hui — dobara koshish karein" });
  }

  let completion: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    completion = await openRouterResp.json();
  } catch {
    return jsonResponse(502, { error: "AI se data process karne mein problem hui — dobara koshish karein" });
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
    warning = "Photo se kuch nahi mila — website URL se try karein";
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
    source_type: "photo_ocr",
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
    action: "auto_extract",
    input_summary: `image=${parsedBody.image_url ? "url" : "base64"}, facts=${facts.length}`,
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
      image_source: parsedBody.image_url ? "url" : "base64",
      facts_count: facts.length,
      source_type: "photo_ocr",
    },
  });

  if (auditError) {
    console.error("audit_log insert failed:", auditError);
  }

  return jsonResponse(200, { facts, businessName, warning });
});
