// Supabase Edge Function: extract-vision
// Runtime: Deno
// Purpose: Extract structured product/variant data from a product image
//          by calling OpenRouter (qwen/qwen-2.5-vl-72b).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "qwen/qwen-2.5-vl-72b";

const SYSTEM_PROMPT = `You are an e-commerce data extraction assistant for Munshee.pk, a Pakistani seller operating system.
Extract ALL product and variant information from the provided image and return it as a single JSON object.

Required JSON schema:
{
  "products": [
    {
      "name": {
        "value": "string - product display name",
        "confidence": "number 0-1 - how certain you are this value is correct based on the image",
        "source_quote": "string - EXACT verbatim text visible in the image that supports this value, max 200 chars. If no clear text snippet exists, set to null"
      },
      "sku": {
        "value": "string - product SKU if visible, otherwise null",
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "description": {
        "value": "string - full product description",
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "category": {
        "value": "string - product category",
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "brand": {
        "value": "string - brand name if visible, otherwise null",
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "status": {
        "value": "active | draft | archived - default to 'draft' if uncertain",
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "tags": {
        "value": ["string"],
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "weight_grams": {
        "value": "number | null - weight in grams if visible",
        "confidence": "number 0-1",
        "source_quote": "string - EXACT text from image, max 200 chars, or null"
      },
      "variants": [
        {
          "sku": {
            "value": "string - variant SKU",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "name": {
            "value": "string - variant name (e.g. 'Red / Large')",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "price": {
            "value": "number - price in PKR",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "compare_at_price": {
            "value": "number | null - original/MSRP if visible",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "cost_price": {
            "value": "number | null - COGS if visible",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "barcode": {
            "value": "string | null",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "options": {
            "value": { "color": "red", "size": "L" } - variant attributes,
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          },
          "status": {
            "value": "active | draft | archived - default 'active'",
            "confidence": "number 0-1",
            "source_quote": "string - EXACT text from image, max 200 chars, or null"
          }
        }
      ]
    }
  ]
}

Rules:
- Extract every distinct product you can see in the image.
- Do NOT invent values. If a field is not visible, use null or [].
- confidence must reflect actual extraction certainty. Explicit values = high confidence. Inferred/implied = lower confidence. Never use a placeholder.
- source_quote must be an exact substring of the original image text. If no clear source snippet exists, set confidence low and source_quote to null. Do not fabricate quotes.
- Prices must be numbers, not strings with currency symbols.
- Return ONLY valid JSON. No markdown, no explanation, no preamble.`;

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

function isFieldObject(value: unknown): value is {
  value: unknown;
  confidence: number;
  source_quote: string | null;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    "value" in v &&
    "confidence" in v &&
    "source_quote" in v &&
    (v.confidence === null || typeof v.confidence === "number")
  );
}

function isValidVariant(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const requiredFields = [
    "sku",
    "name",
    "price",
    "compare_at_price",
    "cost_price",
    "barcode",
    "options",
    "status",
  ];
  return requiredFields.every(
    (field) => isFieldObject((v as Record<string, unknown>)[field])
  );
}

function isValidProduct(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const requiredFields = [
    "name",
    "sku",
    "description",
    "category",
    "brand",
    "status",
    "tags",
    "weight_grams",
  ];
  const hasRequiredFields = requiredFields.every(
    (field) => isFieldObject((v as Record<string, unknown>)[field])
  );
  const hasValidVariants = Array.isArray(v.variants)
    ? v.variants.every(isValidVariant)
    : true;
  return hasRequiredFields && hasValidVariants;
}

function isValidProductsPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { products?: unknown };
  return Array.isArray(v.products) && v.products.every(isValidProduct);
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

  const creditResult = await enforceCredits(supabase, tenantId, "vision_extraction");
  if (!creditResult.ok) {
    return jsonResponse(creditResult.status, creditResult.body as Record<string, unknown>);
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
            text: "Extract all product and variant information visible in this image.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
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
    return jsonResponse(502, { error: "OpenRouter request failed" });
  }

  let completion: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    completion = await openRouterResp.json();
  } catch {
    return jsonResponse(502, { error: "Invalid response from AI model" });
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    return jsonResponse(502, { error: "Invalid response from AI model" });
  }

  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch (err) {
    console.error("JSON parse failed:", err, "raw:", content.slice(0, 500));
    return jsonResponse(502, { error: "Invalid response from AI model" });
  }

  if (!isValidProductsPayload(parsed)) {
    return jsonResponse(502, { error: "Invalid response from AI model" });
  }

  return jsonResponse(200, { data: parsed });
});
