// Supabase Edge Function: extract-text
// Runtime: Deno
// Purpose: Extract structured product/variant data from merchant-supplied text
//          by calling OpenRouter (meta-llama/llama-3.3-70b).

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b";

const SYSTEM_PROMPT = `You are an e-commerce data extraction assistant for Munshee.pk, a Pakistani seller operating system.
Extract ALL product and variant information from the provided text and return it as a single JSON object.

Required JSON schema:
{
  "products": [
    {
      "name": {
        "value": "string - product display name",
        "confidence": "number 0-1 - how certain you are this value is correct",
        "source_quote": "string - EXACT verbatim substring from the input text that supports this value, max 200 chars. If no clear snippet exists, set to null"
      },
      "sku": { "value": "string|null - product SKU if visible, otherwise null", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "description": { "value": "string - full product description", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "category": { "value": "string - product category", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "brand": { "value": "string|null - brand name if visible, otherwise null", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "status": { "value": "active | draft | archived - default to 'draft' if uncertain", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "tags": { "value": ["string"], "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "weight_grams": { "value": "number | null - weight in grams if visible", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
      "variants": [
        {
          "sku": { "value": "string|null - variant SKU", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "name": { "value": "string - variant name (e.g. 'Red / Large')", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "price": { "value": "number - price in PKR", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "compare_at_price": { "value": "number | null - original/MSRP if visible", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "cost_price": { "value": "number | null - COGS if visible", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "barcode": { "value": "string | null", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "options": { "value": { "color": "red", "size": "L" } - variant attributes, "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" },
          "status": { "value": "active | draft | archived - default 'active'", "confidence": "number 0-1", "source_quote": "string|null - exact verbatim substring, max 200 chars, or null" }
        }
      ]
    }
  ]
}

Rules:
- Extract every distinct product you can find.
- Do NOT invent values. If a field is not present in the text, use null for value and set confidence low (e.g. 0.1) with source_quote null.
- confidence must reflect actual extraction certainty. Explicit values = high confidence. Inferred/implied = lower confidence. Never use a placeholder.
- source_quote must be an exact substring of the original input. If no clear source snippet exists, set confidence low and source_quote to null. Do not fabricate quotes.
- Prices must be numbers, not strings with currency symbols.
- source_quote max 200 chars.
- Return ONLY valid JSON. No markdown, no explanation, no preamble.`;

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

function extractJson(content: string): unknown {
  const trimmed = content.trim();

  // Fast path: pure JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Fallback: grab the first {...} block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("No JSON found in model output");
}

type FieldValue = {
  value: unknown;
  confidence: unknown;
  source_quote: unknown;
};

function isFieldObject(value: unknown): value is FieldValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "value") &&
    Object.prototype.hasOwnProperty.call(value, "confidence") &&
    Object.prototype.hasOwnProperty.call(value, "source_quote")
  );
}

function isValidVariant(variant: unknown): boolean {
  if (!variant || typeof variant !== "object") return false;
  const v = variant as Record<string, unknown>;
  const fieldKeys = [
    "sku",
    "name",
    "price",
    "compare_at_price",
    "cost_price",
    "barcode",
    "options",
    "status",
  ];
  return fieldKeys.every((key) => isFieldObject(v[key]));
}

function isValidProduct(product: unknown): boolean {
  if (!product || typeof product !== "object") return false;
  const p = product as Record<string, unknown>;
  const fieldKeys = [
    "name",
    "sku",
    "description",
    "category",
    "brand",
    "status",
    "tags",
    "weight_grams",
  ];
  if (!fieldKeys.every((key) => isFieldObject(p[key]))) return false;
  if (Array.isArray(p.variants)) {
    return p.variants.every((v) => isValidVariant(v));
  }
  return true;
}

function isValidProductsPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { products?: unknown };
  if (!Array.isArray(v.products)) return false;
  return v.products.every((p) => isValidProduct(p));
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

  let body: { text?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return jsonResponse(400, { error: "Missing required field: text" });
  }

  const context = typeof body.context === "string" ? body.context : "";
  const userText = context
    ? `${text}\n\nAdditional context:\n${context}`
    : text;

  const payload = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userText },
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
