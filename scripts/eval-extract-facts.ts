// eval-extract-facts.ts
// Deno script: evaluate the extract-facts pipeline against a single URL or
// a batch of Pakistani business sites. Mirrors the behaviour of the Supabase
// edge function (supabase/functions/extract-facts/index.ts) so we can dry-run
// it locally without auth/rate-limit/action-ledge overhead.
//
// Usage:
//   deno run --allow-net --allow-env scripts/eval-extract-facts.ts URL
//   deno run --allow-net --allow-env scripts/eval-extract-facts.ts --batch
//
// Environment:
//   OPENROUTER_API_KEY  if set, the script will also call the LLM and validate
//                       the returned facts. If not set, the script prints the
//                       fetched context only and a hint.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b";

const SYSTEM_PROMPT = `You extract structured business facts from raw website text of small Pakistani businesses. Output ONLY valid JSON:
{"businessName":"...","facts":[{"category":"...","label":"...","value":"...","confidence":0.0,"quote":"..."}]}
Categories: identity, contact, timings, delivery, payment, policy, product, faq.
NEVER invent facts. Uncertain → confidence <0.5. Products include PKR prices as written. Handle Urdu and Roman Urdu natively. Max 25 facts.
quote = max 12 words copied verbatim from source text.`;

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

const BATCH_SITES: string[] = [
  "https://thelahories.pk",
  "https://salaur.pk",
  "https://hadielectronics.com.pk",
  "https://royli.com",
  "https://roon.pk",
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string): Promise<{ html: string; textLen: number; source: "direct" | "jina" | "none" }> {
  try {
    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), 15_000);
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: ctl.signal,
    });
    clearTimeout(tid);

    if (resp.ok) {
      const html = await resp.text();
      if (html.length >= 500) return { html, textLen: html.length, source: "direct" };
    }
  } catch (err) {
    console.error(`[direct fetch failed] ${url}:`, (err as Error).message);
  }

  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), 20_000);
    const resp = await fetch(jinaUrl, { signal: ctl.signal });
    clearTimeout(tid);
    if (resp.ok) {
      const html = await resp.text();
      return { html, textLen: html.length, source: "jina" };
    }
  } catch (err) {
    console.error(`[jina fetch failed] ${url}:`, (err as Error).message);
  }

  return { html: "", textLen: 0, source: "none" };
}

function buildContext(html: string): { title: string; metaDescription: string; ogTags: Record<string, string>; visibleText: string; context: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1] : "";

  const ogTags: Record<string, string> = {};
  const ogRegex = /<meta[^>]+property=["']og:([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = ogRegex.exec(html)) !== null) {
    ogTags[m[1]] = m[2];
  }

  const visibleText = stripHtml(html).slice(0, 12000);

  let ctx = `Page Title: ${title}`;
  if (metaDescription) ctx += `\nMeta Description: ${metaDescription}`;
  if (ogTags.title) ctx += `\nOG Title: ${ogTags.title}`;
  if (ogTags.description) ctx += `\nOG Description: ${ogTags.description}`;
  if (ogTags.image) ctx += `\nOG Image: ${ogTags.image}`;
  if (ogTags.url) ctx += `\nOG URL: ${ogTags.url}`;
  ctx += `\n\nPage Content:\n${visibleText}`;
  return { title, metaDescription, ogTags, visibleText, context: ctx };
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

type Fact = { category: string; label: string; value: string; confidence: number; quote: string };

function validateFact(fact: unknown): Fact | null {
  if (!fact || typeof fact !== "object") return null;
  const f = fact as Record<string, unknown>;
  const category = typeof f.category === "string" ? f.category : "";
  const label = typeof f.label === "string" ? f.label : "";
  const value = typeof f.value === "string" ? f.value : "";
  const confidence = typeof f.confidence === "number" ? f.confidence : -1;
  const quote = typeof f.quote === "string" ? f.quote : "";
  if (!VALID_CATEGORIES.has(category)) return null;
  if (label.length === 0 || value.length === 0) return null;
  if (confidence < 0 || confidence > 1) return null;
  const wc = quote.trim().split(/\s+/).filter(Boolean).length;
  if (wc > 12) return null;
  return { category, label, value, confidence, quote };
}

async function callLLM(context: string, apiKey: string): Promise<{ businessName: string; facts: Fact[]; raw: string }> {
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
  return { businessName, facts, raw: content };
}

function summarizeFacts(facts: Fact[]) {
  const byCat: Record<string, number> = {};
  let confSum = 0;
  let validQuoteCount = 0;
  for (const f of facts) {
    byCat[f.category] = (byCat[f.category] || 0) + 1;
    confSum += f.confidence;
    const wc = f.quote.trim().split(/\s+/).filter(Boolean).length;
    if (wc > 0 && wc <= 12) validQuoteCount++;
  }
  const avgConf = facts.length ? confSum / facts.length : 0;
  return { count: facts.length, byCategory: byCat, avgConfidence: avgConf, validQuoteCount };
}

async function evaluateOne(url: string): Promise<void> {
  console.log(`\n========== ${url} ==========`);
  const { html, textLen, source } = await fetchPage(url);
  console.log(`fetch: source=${source} bytes=${textLen}`);
  if (!html) {
    console.log("RESULT: no content retrieved (dead/unreachable)");
    return;
  }

  const { title, metaDescription, ogTags, context } = buildContext(html);
  console.log(`title: ${title}`);
  console.log(`meta : ${metaDescription}`);
  console.log(`og   : ${JSON.stringify(ogTags)}`);
  console.log(`context chars: ${context.length}`);
  console.log(`\n----- CONTEXT (first 1500 chars) -----\n${context.slice(0, 1500)}\n----- /CONTEXT -----\n`);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.log("Set OPENROUTER_API_KEY to run LLM evaluation");
    return;
  }

  try {
    const { businessName, facts, raw } = await callLLM(context, apiKey);
    const stats = summarizeFacts(facts);
    console.log(`\n----- LLM RESULT -----\nbusinessName: ${businessName}`);
    console.log(`facts: ${stats.count} (avg conf ${stats.avgConfidence.toFixed(2)})`);
    console.log(`by category: ${JSON.stringify(stats.byCategory)}`);
    console.log(`quotes valid (<=12 words): ${stats.validQuoteCount}/${stats.count}`);
    console.log(JSON.stringify(facts, null, 2));
    console.log(`\n----- RAW MODEL OUTPUT (first 800 chars) -----\n${raw.slice(0, 800)}`);
  } catch (err) {
    console.error(`LLM call failed: ${(err as Error).message}`);
  }
}

async function main() {
  const args = Deno.args;
  if (args.includes("--batch") || args.length === 0) {
    console.log(`Batch mode: ${BATCH_SITES.length} sites`);
    for (const u of BATCH_SITES) await evaluateOne(u);
    return;
  }
  await evaluateOne(args[0]);
}

if (import.meta.main) {
  await main();
}
