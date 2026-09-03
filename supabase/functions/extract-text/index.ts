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
      "name": "string - product display name",
      "sku": "string - product SKU if visible, otherwise null",
      "description": "string - full product description",
      "category": "string - product category",
      "brand": "string - brand name if visible, otherwise null",
      "status": "active | draft | archived - default to 'draft' if uncertain",
      "tags": ["string"],
      "weight_grams": "number | null - weight in grams if visible",
      "variants": [
        {
          "sku": "string - variant SKU",
          "name": "string - variant name (e.g. 'Red / Large')",
          "price": "number - price in PKR",
          "compare_at_price": "number | null - original/MSRP if visible",
          "cost_price": "number | null - COGS if visible",
          "barcode": "string | null",
          "options": { "color": "red", "size": "L" } - variant attributes",
          "status": "active | draft | archived - default 'active'"
        }
      ]
    }
  ]
}

Rules:
- Extract every distinct product you can find.
- Do NOT invent values. If a field is not present in the text, use null or [].
- Prices must be numbers, not strings with currency symbols.
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

function isValidProductsPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { products?: unknown };
  return Array.isArray(v.products);
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