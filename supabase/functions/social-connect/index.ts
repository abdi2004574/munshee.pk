// Supabase Edge Function: social-connect
// Runtime: Deno
// Purpose: Facebook / Instagram OAuth "one-tap connect" for munshee.pk.
//   POST  -> initiate: validate JWT, return Meta OAuth dialog URL.
//   GET   -> callback: Meta redirects here with code+state, exchanges the code
//            for a page access token, aggregates page / IG content, runs
//            extract-text + extract-vision, persists business facts + audit log,
//            then 302-redirects back to the frontend.
//
// NOTE: This is code-complete-but-untested-pending-credentials. The founder has
// not yet registered a Facebook/Instagram app or set the Edge Function secrets
// (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET / SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v18.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type FieldValue = {
  value: unknown;
  confidence: unknown;
  source_quote: unknown;
};

type ExtractedVariant = {
  sku: FieldValue;
  name: FieldValue;
  price: FieldValue;
  compare_at_price: FieldValue;
  cost_price: FieldValue;
  barcode: FieldValue;
  options: FieldValue;
  status: FieldValue;
};

type ExtractedProduct = {
  name: FieldValue;
  sku: FieldValue;
  description: FieldValue;
  category: FieldValue;
  brand: FieldValue;
  status: FieldValue;
  tags: FieldValue;
  weight_grams: FieldValue;
  variants: ExtractedVariant[];
};

type BusinessFactInsert = {
  tenant_id: string;
  category: string;
  label: string;
  value: string;
  confidence: number | null;
  source_type: string;
  source_ref: string | null;
  linked_table: string | null;
  linked_row_id: string | null;
  status: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Location: location,
    },
  });
}

// Mirror of the buildFacts() pattern from
// src/features/extraction/pages/ExtractTextPage.tsx, generalised over
// source_type so it can serve both providers.
function buildFacts(
  products: ExtractedProduct[],
  tenantId: string,
  sourceType: string,
): BusinessFactInsert[] {
  const facts: BusinessFactInsert[] = [];

  const PRODUCT_FIELD_KEYS = [
    "name",
    "sku",
    "description",
    "category",
    "brand",
    "status",
    "tags",
    "weight_grams",
  ] as const;

  const VARIANT_PRICING_FIELDS = ["price", "compare_at_price", "cost_price"] as const;
  const VARIANT_PRODUCT_FIELDS = ["sku", "name", "barcode", "options", "status"] as const;

  for (const product of products) {
    for (const key of PRODUCT_FIELD_KEYS) {
      const field = (product as Record<string, FieldValue>)[key];
      facts.push({
        tenant_id: tenantId,
        category: "product",
        label: key,
        value: String(field.value),
        confidence: typeof field.confidence === "number" ? field.confidence : null,
        source_ref: typeof field.source_quote === "string" ? field.source_quote : null,
        source_type: sourceType,
        linked_table: "products",
        linked_row_id: null,
        status: "needs_review",
      });
    }

    for (const variant of product.variants ?? []) {
      for (const key of VARIANT_PRICING_FIELDS) {
        const field = (variant as Record<string, FieldValue>)[key];
        facts.push({
          tenant_id: tenantId,
          category: "pricing",
          label: key,
          value: String(field.value),
          confidence: typeof field.confidence === "number" ? field.confidence : null,
          source_ref: typeof field.source_quote === "string" ? field.source_quote : null,
          source_type: sourceType,
          linked_table: "product_variants",
          linked_row_id: null,
          status: "needs_review",
        });
      }

      for (const key of VARIANT_PRODUCT_FIELDS) {
        const field = (variant as Record<string, FieldValue>)[key];
        facts.push({
          tenant_id: tenantId,
          category: "product",
          label: key,
          value: String(field.value),
          confidence: typeof field.confidence === "number" ? field.confidence : null,
          source_ref: typeof field.source_quote === "string" ? field.source_quote : null,
          source_type: sourceType,
          linked_table: "product_variants",
          linked_row_id: null,
          status: "needs_review",
        });
      }
    }
  }

  return facts;
}

// Opaque base64 state token carrying tenant_id + provider through the OAuth dance.
function encodeState(obj: { tenant_id: string; provider: string }): string {
  return btoa(JSON.stringify(obj));
}

function decodeState(state: string): { tenant_id: string; provider: string } | null {
  try {
    const decoded = atob(state.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as { tenant_id: string; provider: string };
  } catch {
    return null;
  }
}

const FACEBOOK_SCOPES = [
  "pages_show_articles",
  "pages_read_engagement",
  "pages_read_user_content",
  "instagram_basic",
].join(",");

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "pages_read_engagement",
  "pages_show_articles",
].join(",");

async function graphGet(
  path: string,
  token: string,
): Promise<Record<string, unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const resp = await fetch(
    `${GRAPH_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`,
  );
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Graph API ${resp.status}: ${txt}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

// Invoke another Edge Function over HTTP (extract-text / extract-vision).
async function invokeFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  fn: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`${fn} returned ${resp.status}: ${txt}`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

function productsFromPayload(payload: Record<string, unknown>): ExtractedProduct[] {
  const nested = payload.data as { products?: unknown } | undefined;
  const products = nested?.products ?? (payload.products as unknown[] | undefined);
  return (Array.isArray(products) ? products : []) as ExtractedProduct[];
}

async function extractProductsFromText(
  supabaseUrl: string,
  serviceRoleKey: string,
  text: string,
): Promise<ExtractedProduct[]> {
  const payload = await invokeFunction(supabaseUrl, serviceRoleKey, "extract-text", {
    text,
  });
  return productsFromPayload(payload);
}

async function extractProductsFromImage(
  supabaseUrl: string,
  serviceRoleKey: string,
  imageUrl: string,
): Promise<ExtractedProduct[]> {
  const payload = await invokeFunction(
    supabaseUrl,
    serviceRoleKey,
    "extract-vision",
    { image_url: imageUrl },
  );
  return productsFromPayload(payload);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ---- Callback: GET ?code=...&state=... ----
  if (method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://munshee.pk";

    if (!code || !state) {
      // Not a callback (no code/state). Redirect to the frontend so the
      // browser never renders a raw Edge Function error page.
      return redirect(`${frontendUrl}/apps/social`);
    }

    const decoded = decodeState(state);
    if (!decoded) {
      return redirect(`${frontendUrl}/apps/social?error=invalid_state`);
    }
    const { tenant_id, provider } = decoded;

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const tokenEncryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY");

    if (!appId || !appSecret || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        error: "Facebook OAuth credentials not configured",
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/social-connect`;

    try {
      // 1. Exchange the code for a short-lived user access token.
      const tokenResp = await fetch(
        `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          code,
          redirect_uri: redirectUri,
        }).toString()}`,
      );
      if (!tokenResp.ok) {
        const txt = await tokenResp.text().catch(() => "");
        throw new Error(`Token exchange failed (${tokenResp.status}): ${txt}`);
      }
      const tokenJson = (await tokenResp.json()) as {
        access_token: string;
        expires_in?: number;
      };
      const userToken = tokenJson.access_token;
      let tokenExpiresAt: string | null = null;
      if (tokenJson.expires_in) {
        tokenExpiresAt = new Date(
          Date.now() + Number(tokenJson.expires_in) * 1000,
        ).toISOString();
      }

      // 2. List the pages this user manages.
      const pagesJson = await graphGet("/me/accounts", userToken) as {
        data?: Array<Record<string, unknown>>;
      };
      const pages = pagesJson.data ?? [];

      if (pages.length === 0) {
        return redirect(
          `${frontendUrl}/apps/social?connected=${provider}&facts=0&error=no_pages`,
        );
      }

      const page = pages[0];
      const pageId = String(page.id);
      const pageName = page.name ? String(page.name) : null;
      // Page-scoped token carries page reading privileges.
      const pageToken = String(page.access_token ?? userToken);

      // 3. Persist (upsert) the connection.
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        db: { schema: "public" },
        auth: { persistSession: false },
      });

      let encryptedToken: Uint8Array | null = null;
      if (tokenEncryptionKey) {
        const { data: encrypted, error: encryptError } = await supabase.rpc(
          "encrypt_token",
          {
            p_token: pageToken,
            p_key: tokenEncryptionKey,
          },
        );
        if (!encryptError && encrypted) {
          encryptedToken = new Uint8Array(encrypted as number[]);
        }
      }

      const upsertPayload: Record<string, unknown> = {
        tenant_id,
        provider,
        page_id: pageId,
        page_name: pageName,
        access_token: pageToken,
        token_expires_at: tokenExpiresAt,
        last_sync_at: new Date().toISOString(),
      };

      if (encryptedToken) {
        upsertPayload.encrypted_token = encryptedToken;
      }

      const { data: conn, error: upsertError } = await supabase
        .from("social_connections")
        .upsert(upsertPayload, { onConflict: "tenant_id,provider,page_id" })
        .select("id")
        .single();

      if (upsertError || !conn) {
        throw new Error(
          `Failed to persist connection: ${upsertError?.message ?? "unknown"}`,
        );
      }

      const connectionId = String((conn as Record<string, unknown>).id);
      const sourceType = `${provider}_oauth`;

      // 4. Aggregate content & image URLs depending on provider.
      let textBlock = "";
      const imageUrls: string[] = [];

      if (provider === "facebook") {
        // 4a. Page profile info
        const pageFields = await graphGet(
          `/${pageId}?fields=name,about,description,category`,
          pageToken,
        );
        const parts: string[] = [];
        if (pageFields.name) parts.push(`Page name: ${pageFields.name}`);
        if (pageFields.about) parts.push(`About: ${pageFields.about}`);
        if (pageFields.description) parts.push(`Description: ${pageFields.description}`);
        if (pageFields.category) parts.push(`Category: ${pageFields.category}`);
        textBlock += parts.join("\n");

        // 4b. Recent posts (captions)
        const postsJson = await graphGet(
          `/${pageId}/posts?fields=message,created_time&limit=25`,
          pageToken,
        ) as { data?: Array<Record<string, unknown>> };
        for (const post of postsJson.data ?? []) {
          if (post.message) textBlock += `\n${String(post.message)}`;
        }

        // 4c. Photos (image URLs + captions)
        const photosJson = await graphGet(
          `/${pageId}/photos?fields=images,name,caption&limit=50`,
          pageToken,
        ) as { data?: Array<Record<string, unknown>> };
        for (const photo of photosJson.data ?? []) {
          if (photo.caption) textBlock += `\n${String(photo.caption)}`;
          if (photo.name) textBlock += `\n${String(photo.name)}`;
          const images = photo.images as Array<{ source?: string }> | undefined;
          if (Array.isArray(images) && images.length > 0) {
            const img = images[0]?.source;
            if (img) imageUrls.push(img);
          }
        }
      } else if (provider === "instagram") {
        // 4a. Resolve the IG Business Account id linked to the page.
        const igInfo = await graphGet(
          `/${pageId}?fields=instagram_business_account`,
          pageToken,
        ) as { instagram_business_account?: { id: string } };
        const igUserId = igInfo.instagram_business_account?.id;
        if (!igUserId) {
          throw new Error("No Instagram Business Account linked to this page");
        }

        // 4b. IG profile
        const igProfile = await graphGet(
          `/${igUserId}?fields=name,biography,username,followers_count`,
          pageToken,
        ) as Record<string, unknown>;
        const igParts: string[] = [];
        if (igProfile.name) igParts.push(`Name: ${igProfile.name}`);
        if (igProfile.username) igParts.push(`Username: ${igProfile.username}`);
        if (igProfile.biography) igParts.push(`Bio: ${igProfile.biography}`);
        textBlock += igParts.join("\n");

        // 4c. IG media (captions + image urls)
        const igMedia = await graphGet(
          `/${igUserId}/media?fields=caption,media_type,media_url,thumbnail_url&limit=25`,
          pageToken,
        ) as { data?: Array<Record<string, unknown>> };
        for (const item of igMedia.data ?? []) {
          if (item.caption) textBlock += `\n${String(item.caption)}`;
          const mediaType = String(item.media_type ?? "");
          if (mediaType === "IMAGE" && item.media_url) {
            imageUrls.push(String(item.media_url));
          }
          if (item.thumbnail_url) {
            imageUrls.push(String(item.thumbnail_url));
          }
        }
      }

      // 5. Run extract-text on the aggregated content, and extract-vision on
      //    every image URL. Merge results, then build facts.
      let allProducts: ExtractedProduct[] = [];

      if (textBlock.trim()) {
        try {
          allProducts = allProducts.concat(
            await extractProductsFromText(supabaseUrl, serviceRoleKey, textBlock),
          );
        } catch (extractErr) {
          console.error("extract-text failed:", extractErr);
        }
      }

      for (const img of imageUrls) {
        try {
          allProducts = allProducts.concat(
            await extractProductsFromImage(supabaseUrl, serviceRoleKey, img),
          );
        } catch (visionErr) {
          console.error("extract-vision failed:", visionErr);
        }
      }

      // 6. Build + persist business facts.
      const facts = buildFacts(allProducts, tenant_id, sourceType);
      let factCount = 0;

      if (facts.length > 0) {
        const { error: factsError } = await supabase
          .from("business_facts")
          .insert(facts);
        if (factsError) {
          throw new Error(`Failed to insert facts: ${factsError.message}`);
        }
        factCount = facts.length;
      }

      // 7. Log to audit_log.
      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id,
        fact_id: null,
        actor: tenant_id,
        action: "import",
        old_value: null,
        new_value: {
          source_type: sourceType,
          connection_id: connectionId,
          provider,
          page_id: pageId,
          facts_count: factCount,
        },
      });
      if (auditError) {
        console.error("audit_log insert failed:", auditError);
        // Non-fatal: facts were already persisted.
      }

      // 8. Redirect back to the frontend with the result.
      return redirect(
        `${frontendUrl}/apps/social?connected=${provider}&facts=${factCount}`,
      );
    } catch (err) {
      console.error("social-connect callback error:", err);
      return redirect(
        `${frontendUrl}/apps/social?connected=${provider}&facts=0&error=sync_failed`,
      );
    }
  }

  // ---- Initiate: POST { provider } ----
  if (method === "POST") {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(500, {
        error: "Supabase environment not configured",
      });
    }

    // Validate the caller JWT.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    const tenantId = authData.user.id;

    // Validate provider.
    let provider: string;
    try {
      const body = await req.json();
      provider = (body as { provider?: unknown }).provider as string;
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    if (provider !== "facebook" && provider !== "instagram") {
      return jsonResponse(400, {
        error: "Invalid provider; expected 'facebook' or 'instagram'",
      });
    }

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    if (!appId || !appSecret) {
      return jsonResponse(500, {
        error: "Facebook OAuth credentials not configured",
      });
    }

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://munshee.pk";
    const redirectUri = `${supabaseUrl}/functions/v1/social-connect`;
    const state = encodeState({ tenant_id: tenantId, provider });
    const scopes = provider === "instagram" ? INSTAGRAM_SCOPES : FACEBOOK_SCOPES;

    const authUrl = `${GRAPH_BASE}/dialog/oauth?${new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: "code",
    }).toString()}`;

    return jsonResponse(200, { auth_url: authUrl });
  }

  // Anything else
  return jsonResponse(405, { error: "Method not allowed" });
});
