// Supabase Edge Function: re-scan-business
// Runtime: Deno
// Purpose: Level 1 autonomous re-scanning with delta detection.
//          Fetches the business website, extracts facts via LLM,
//          diffs against confirmed facts, and persists only deltas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b";

const SYSTEM_PROMPT = `You extract structured business facts from raw website text of small Pakistani businesses. Output ONLY valid JSON:
{"businessName":"...","facts":[{"category":"...","label":"...","value":"...","confidence":0.0,"quote":"..."}]}
Categories: identity, contact, timings, delivery, payment, policy, product, faq.
NEVER invent facts. Uncertain -> confidence <0.5. Products include PKR prices as written. Handle Urdu and Roman Urdu natively. Max 25 facts.
quote = max 12 words copied verbatim from source text.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BODY_SCHEMA = z.object({ url: z.string().url().optional() });

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

type Fact = {
  category: string;
  label: string;
  value: string;
  confidence: number;
  quote: string;
};


function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) return JSON.parse(fenceMatch[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
  throw new Error("No JSON found in model output");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageContent(targetUrl: string): Promise<string> {
  let html = "";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      html = await resp.text();
    }
    if (!resp.ok || html.length < 500) {
      const jinaUrl = `https://r.jina.ai/${targetUrl}`;
      const jinaController = new AbortController();
      const jinaTimeoutId = setTimeout(() => jinaController.abort(), 20000);
      const jinaResp = await fetch(jinaUrl, { signal: jinaController.signal });
      clearTimeout(jinaTimeoutId);
      if (jinaResp.ok) {
        html = await jinaResp.text();
      }
    }
  } catch (err) {
    console.error("Fetch error:", err);
    throw new Error("Failed to fetch the provided URL");
  }
  if (!html || html.length === 0) {
    throw new Error("Failed to retrieve content from the provided URL");
  }
  return html;
}

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

async function consumeAction(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  actionType: string,
): Promise<{ ok: boolean; actions_left: number; subscription_status: string }> {
  const { data, error } = await supabase.rpc("consume_action", {
    p_business_id: businessId,
    p_action_type: actionType,
  } as never);

  if (error) {
    console.error("consume_action failed:", error);
    return { ok: false, actions_left: 0, subscription_status: "unknown" };
  }

  const result = data as { ok: boolean; actions_left: number; subscription_status: string } | null;
  if (!result) {
    return { ok: false, actions_left: 0, subscription_status: "unknown" };
  }

  return {
    ok: result.ok,
    actions_left: result.actions_left,
    subscription_status: result.subscription_status,
  };
}

async function extractFactsFromContent(html: string, apiKey: string): Promise<Fact[]> {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";

  const metaDescMatch = html.match(/<meta[^>]+name=['"]description['"][^>]*content=['"]([^'"]*)['"][^>]*>/i)
    || html.match(/<meta[^>]+content=['"]([^'"]*)['"][^>]*name=['"]description['"][^>]*>/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1] : "";

  const ogTags: Record<string, string> = {};
  const ogRegex = /<meta[^>]+property=['"]og:([^'"]+)['"][^>]*content=['"]([^'"]*)['"][^>]*>/gi;
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

  const result = await callLLM(context, apiKey);
  return result.facts;
}


async function callLLM(context: string, apiKey: string): Promise<{ businessName: string; facts: Fact[] }> {
  const resp = await fetch(OPENROUTER_URL, {
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

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenRouter ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const completion = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("Invalid response from AI model");
  }

  const parsed = extractJson(content) as Record<string, unknown>;
  const businessName = typeof parsed.businessName === "string" ? parsed.businessName : "";
  const rawFacts = Array.isArray(parsed.facts) ? parsed.facts : [];
  const facts = rawFacts.map(validateFact).filter((f): f is Fact => f !== null).slice(0, 25);
  return { businessName, facts };
}

async function getLevel(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  actionType: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("get_autonomy_level_with_kill_switch", {
    p_business_id: businessId,
    p_action_type: actionType,
  } as never);
  if (error) throw error;
  return data as number;
}

async function writeLedgerEntry(
  supabase: ReturnType<typeof createClient>,
  ctx: { businessId: string; actorType: string; autonomyLevel: number },
  toolName: string,
  inputSummary: string,
  resultSummary: string,
  status: "success" | "failed",
  estimatedValuePkr: number = 0,
  reversible: boolean = false,
): Promise<void> {
  const { error } = await supabase
    .from("action_ledger" as never)
    .insert({
      business_id: ctx.businessId,
      actor_type: ctx.actorType,
      tool_name: toolName,
      input_summary: inputSummary,
      result_summary: resultSummary,
      status,
      autonomy_level: ctx.autonomyLevel,
      estimated_value_pkr: estimatedValuePkr,
      reversible,
    } as never);
  if (error) {
    console.error(`Failed to write ledger entry for ${toolName}:`, error);
  }
}

async function resolveUrl(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  urlOverride?: string,
): Promise<string> {
  if (urlOverride) return urlOverride;

  const { data: connections, error } = await supabase
    .from("social_connections" as never)
    .select("provider, page_id")
    .eq("tenant_id", tenantId)
    .eq("deleted_at", null)
    .limit(1);

  if (error || !connections || connections.length === 0) {
    throw new Error("NO_URL");
  }

  const conn = connections[0] as { provider: string; page_id: string };
  return `https://${conn.provider}.com/${conn.page_id}`;
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

  const autonomy = await getLevel(supabase, tenantId, "rescan");
  if (autonomy < 1) {
    await writeLedgerEntry(
      supabase,
      { businessId: tenantId, actorType: "system", autonomyLevel: autonomy },
      "re_scan_business",
      JSON.stringify({ url: parsedBody.url }).slice(0, 200),
      "blocked: autonomy level insufficient (need >=1)",
      "failed",
      0,
      true,
    );
    return jsonResponse(403, { error: "Insufficient autonomy level for re-scan" });
  }

  const actionResult = await consumeAction(supabase, tenantId, "rescan");
  if (!actionResult.ok) {
    return jsonResponse(402, {
      code: "ACTIONS_EXHAUSTED",
      error: "actions_exhausted",
      message: "Aapke mahine ke Actions khatam ho gaye - agle month dobara milenge, ya Business plan lein.",
      actionsLeft: actionResult.actions_left,
      subscriptionStatus: actionResult.subscription_status,
    });
  }

  let targetUrl: string;
  try {
    targetUrl = await resolveUrl(supabase, tenantId, parsedBody.url);
  } catch (err) {
    if (err instanceof Error && err.message === "NO_URL") {
      return jsonResponse(400, {
        error: "no_url",
        message: "Koi website URL nahi mili. Apni website ka URL provide karein ya social connection add karein.",
      });
    }
    throw err;
  }

  let html: string;
  let textLen = 0;
  try {
    html = await fetchPageContent(targetUrl);
    textLen = html.length;
  } catch (err) {
    console.error("Fetch error:", err);
    return jsonResponse(502, { error: "Failed to fetch the provided URL" });
  }

  const apiKeyForLLM = Deno.env.get("OPENROUTER_API_KEY")!;
  let newFacts: Fact[];
  try {
    const extracted = await extractFactsFromContent(html, apiKeyForLLM);
    newFacts = extracted;
  } catch (err) {
    console.error("LLM extraction failed:", err);
    return jsonResponse(502, { error: "Failed to extract facts from website" });
  }

  const { data: confirmedRows, error: factsError } = await supabase
    .from("business_facts" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .is("deleted_at", null);

  if (factsError) {
    console.error("Failed to load confirmed facts:", factsError);
    return jsonResponse(500, { error: "Failed to load confirmed facts" });
  }

  const confirmedFacts = (confirmedRows ?? []) as Array<{
    id: string;
    category: string;
    label: string;
    value: string;
    linked_table: string | null;
    linked_row_id: string | null;
  }>;

  const confirmedMap = new Map<string, typeof confirmedFacts[0]>();
  for (const f of confirmedFacts) {
    confirmedMap.set(`${f.category}|${f.label}`, f);
  }

  const delta = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  const newFactRows: any[] = [];
  const removedFactIds: string[] = [];

  for (const newFact of newFacts) {
    const key = `${newFact.category}|${newFact.label}`;
    const existing = confirmedMap.get(key);
    if (!existing) {
      delta.added++;
      newFactRows.push({
        tenant_id: tenantId,
        category: newFact.category,
        label: newFact.label,
        value: newFact.value,
        confidence: newFact.confidence,
        status: "needs_review",
        source_type: "website_rescan",
        source_ref: newFact.quote,
        linked_table: null,
        linked_row_id: null,
      });
    } else if (existing.value !== newFact.value) {
      delta.changed++;
      newFactRows.push({
        tenant_id: tenantId,
        category: newFact.category,
        label: newFact.label,
        value: newFact.value,
        confidence: 0.9,
        status: "needs_review",
        source_type: "website_rescan",
        source_ref: `Re-scan: site pe ye value ab ${newFact.value} hai (pehle ${existing.value})`,
        linked_table: existing.linked_table,
        linked_row_id: existing.linked_row_id,
      });
      confirmedMap.delete(key);
    } else {
      delta.unchanged++;
      confirmedMap.delete(key);
    }
  }

  for (const [key, remaining] of confirmedMap) {
    delta.removed++;
    removedFactIds.push(remaining.id);
  }

  if (newFactRows.length > 0) {
    const { error: insertError } = await supabase
      .from("business_facts")
      .insert(newFactRows);

    if (insertError) {
      console.error("Failed to insert new facts:", insertError);
      return jsonResponse(500, { error: "Failed to persist delta facts" });
    }
  }

  for (const id of removedFactIds) {
    const { error: updateError } = await supabase
      .from("business_facts" as never)
      .update({ status: "possibly_removed" })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to mark fact as possibly_removed:", updateError);
    }
  }

  const totalDelta = delta.added + delta.changed + delta.removed;

  const inputSummary = JSON.stringify({
    url: targetUrl,
    text_len: textLen,
    facts_checked: confirmedFacts.length,
    new_facts_found: newFacts.length,
  });

  const resultSummary = JSON.stringify({
    added: delta.added,
    changed: delta.changed,
    removed: delta.removed,
    unchanged: delta.unchanged,
  });

  await writeLedgerEntry(
    supabase,
    { businessId: tenantId, actorType: "system", autonomyLevel: autonomy },
    "re_scan_business",
    inputSummary,
    resultSummary,
    "success",
    0,
    true,
  );

  const { error: auditError } = await supabase.from("audit_log" as never).insert({
    tenant_id: tenantId,
    fact_id: null,
    actor: tenantId,
    action: "rescan_delta",
    old_value: null,
    new_value: {
      url: targetUrl,
      total_delta: totalDelta,
      added: delta.added,
      changed: delta.changed,
      removed: delta.removed,
      unchanged: delta.unchanged,
      source_type: "website_rescan",
    },
  });

  if (auditError) {
    console.error("audit_log insert failed:", auditError);
  }

  if (totalDelta > 0 || newFacts.length > 0) {
    const { error: markError } = await supabase.rpc("mark_rescan_complete", {
      p_business_id: tenantId,
      p_delta_count: totalDelta,
    } as never);

    if (markError) {
      console.error("mark_rescan_complete failed:", markError);
    }
  }

  return jsonResponse(200, {
    facts: newFacts,
    businessName: "",
    delta: {
      added: delta.added,
      changed: delta.changed,
      removed: delta.removed,
      unchanged: delta.unchanged,
    },
    skipped: false,
  });
});
