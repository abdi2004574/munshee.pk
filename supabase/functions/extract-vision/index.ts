// Supabase Edge Function: extract-vision
// Runtime: Deno
// Purpose: Extract structured product/variant data from a product image
//          by calling OpenRouter (qwen/qwen-2.5-vl-72b).

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
  // If it already looks like a data URL, pass it through after validation.
  if (raw.startsWith("data:")) {
    return raw;
  }
  // Heuristic: JPEG base64 often starts with /9j/, PNG with iVBORw0KGgo.
  const head = raw.slice(0, 12);
  if (head.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${raw}`;
  }
  if (head.startsWith("iVBORw0KGgo")) {
    return `data:image/png;base64,${raw}`;
  }
  // Default to PNG if unknown - qwen-vl accepts both.
  return `data:image/png;base64,${raw}`;
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

  let body: { image_url?: unknown; image_base64?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  let imageUrl = "";
  if (typeof body.image_url === "string" && body.image_url.trim() !== "") {
    imageUrl = body.image_url.trim();
  } else if (
    typeof body.image_base64 === "string" &&
    body.image_base64.trim() !== ""
  ) {
    imageUrl = detectMimeAndBuildDataUrl(body.image_base64.trim());
  }

  if (!imageUrl) {
    return jsonResponse(400, {
      error: "Missing required field: image_url or image_base64",
    });
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
