# Deployment Checklist for munshee.pk

Follow these steps in order. Each step is numbered and copy-paste ready.

> **Tip:** Open this file in a split window and tick items off as you go.
> <br>
> *(Screenshot: [ ])*

---

## 1. Prerequisites - Accounts You Need

| # | Account | Why |
|---|---------|-----|
| 1 | **GitHub** | Source code host (munshee.pk repo) |
| 2 | **Cloudflare** (free) | Frontend hosting via Cloudflare Pages |
| 3 | **Supabase** (free tier) | Database, Auth, and Edge Functions |

Make sure you have admin or owner access to all three before continuing.

> *(Screenshot: [ ])*

---

## 2. Cloudflare Pages - Connect Your Repo

### Step 2.1 - Create a new Pages project

1. Go to https://dash.cloudflare.com/pages
2. Click **Create a project** -> **Connect to Git**
3. Authorize Cloudflare to access your GitHub account if prompted
4. Select the **munshee.pk** repository
5. Click **Begin setup**

### Step 2.2 - Configure build settings

Fill in the fields exactly as shown below:

| Field | Value |
|-------|-------|
| **Production branch** | `main` |
| **Build command** | `pnpm cf:build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` |
| **Node.js version** | `20` (or leave blank to use default) |

> **Important:** The build command is `pnpm cf:build`, **not** `pnpm build`.
> The `cf:build` script skips `tsc -b` because Cloudflare Pages already runs TypeScript checks separately.

> *(Screenshot: [ ])*

### Step 2.3 - Deploy

1. Click **Save and Deploy**
2. Wait 60-90 seconds for the first deployment
3. Cloudflare will give you a `*.pages.dev` URL - **copy it** now. You will need it in Step 3.

Example URL format: `https://munshee-pk-abc123.pages.dev`

> *(Screenshot: [ ])*

---

## 3. Cloudflare Pages - Environment Variables

You need to set these in **every** deployment environment (Production and Preview).

### Step 3.1 - Navigate to environment variables

1. In Cloudflare Pages, open your project
2. Go to **Settings** -> **Environment variables**
3. Make sure the toggle is set to **Production** (not Preview) when adding vars for production
4. Add each variable below

### Step 3.2 - Add the variables

| Variable name | Value | Notes |
|---------------|-------|-------|
| `VITE_SUPABASE_URL` | `https://mxqnpmzagiggkzwbrnns.supabase.co` | Replace with your Supabase project URL if different |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` (your anon/public key) | From Supabase Dashboard -> Settings -> API |
| `VITE_SUPABASE_REDIRECT_URL` | `https://munshee-pk-abc123.pages.dev/auth/callback` | **Must match your pages.dev URL exactly** |

> **Copy-paste instruction:** Replace `munshee-pk-abc123.pages.dev` with the actual URL Cloudflare gave you in Step 2.3.

> *(Screenshot: [ ])*

### Step 3.3 - Trigger a new deploy

After adding env vars, trigger a new deploy so they take effect:

1. Go to **Deployments** tab
2. Click **Retry deployment** on the latest attempt
3. Wait for the green checkmark

> *(Screenshot: [ ])*

---

## 4. Supabase - Auth Configuration

### Step 4.1 - Open your Supabase project

1. Go to https://supabase.com/dashboard
2. Select your **munshee-pk** project

### Step 4.2 - Set Site URL

1. Go to **Authentication** -> **URL Configuration**
2. Set **Site URL** to:

```
https://munshee-pk-abc123.pages.dev
```

> Replace `munshee-pk-abc123.pages.dev` with your actual pages.dev URL.

### Step 4.3 - Add Redirect URLs

1. Under **Redirect URLs**, click **Add URL**
2. Add **exactly** these two URLs:

```
https://munshee-pk-abc123.pages.dev/auth/callback
http://localhost:5173/auth/callback
```

> The `localhost` entry is required so local development still works.

### Step 4.4 - Save

Click **Save** at the bottom of the page.

> *(Screenshot: [ ])*

---

## 5. Supabase - Edge Function Secrets

### Step 5.1 - Set OPENROUTER_API_KEY

1. In Supabase Dashboard, go to **Edge Functions** -> **Secrets**
2. Click **Add secret**
3. Enter the following:

| Field | Value |
|-------|-------|
| **Name** | `OPENROUTER_API_KEY` |
| **Value** | `sk-or-...` (your key from https://openrouter.ai/keys) |

4. Click **Save**

> **Where to get the key:** Sign up at https://openrouter.ai -> Keys -> Create Key.
> Copy the key starting with `sk-or-` and paste it here.

> *(Screenshot: [ ])*

---

## 6. ALLOWED_ORIGINS / CORS - Update to Include pages.dev

### Step 6.1 - Check for ALLOWED_ORIGINS

1. Check if your project has an `ALLOWED_ORIGINS` setting anywhere in Supabase (Edge Functions, Database, or Settings)
2. If it exists, add your pages.dev origin to it:

```
https://munshee-pk-abc123.pages.dev
```

### Step 6.2 - If using environment variable in Edge Functions

If your Edge Functions reference `ALLOWED_ORIGINS` as an env var, set it in Supabase Edge Functions -> Secrets:

| Name | Value |
|------|-------|
| `ALLOWED_ORIGINS` | `https://munshee-pk-abc123.pages.dev` |

### Step 6.3 - CORS headers

The Edge Functions currently set `Access-Control-Allow-Origin: *` in their code. This is acceptable for development. For production, restrict it to your exact domain in each Edge Function's `corsHeaders` object.

> *(Screenshot: [ ])*

---

## 7. Post-Deploy Verification

After the deploy in Step 3.3 finishes, run through these checks:

| # | Check | Expected result |
|---|-------|-----------------|
| 1 | Visit your `*.pages.dev` URL | Page loads without errors |
| 2 | Open browser DevTools -> Console | No 404s, no CORS errors |
| 3 | Click **Login** or **Sign up** | Redirects to Supabase auth page |
| 4 | Complete login flow | Redirects back to `/dashboard` |
| 5 | Navigate to `/apps/pricing` or `/pricing` | Pricing page renders with plans |
| 6 | Test on mobile viewport (DevTools) | Layout is responsive |

### If anything fails:

- **Page loads blank:** Check Cloudflare Pages build logs for errors
- **Auth redirect fails:** Double-check `VITE_SUPABASE_REDIRECT_URL` matches the pages.dev URL exactly
- **CORS errors:** Verify `ALLOWED_ORIGINS` includes your pages.dev domain
- **Database errors:** Verify migrations ran successfully in Supabase SQL Editor

> *(Screenshot: [ ])*

---

## 8. Custom Domain Setup (Optional)

**Do this only after the pages.dev URL works perfectly.**

### Step 8.1 - Add domain to Cloudflare

1. In Cloudflare Pages project, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter `munshee.pk` (and `www.munshee.pk` if desired)
4. Click **Continue**

### Step 8.2 - Update DNS

Cloudflare will auto-create DNS records if `munshee.pk` is already on Cloudflare. If not:

| Provider | Action |
|----------|--------|
| Cloudflare DNS | Add a `CNAME` record: `munshee.pk` -> `munshee-pk-abc123.pages.dev` |
| GoDaddy / Namecheap / other | Add/update nameservers to point to Cloudflare, then add CNAME |

### Step 8.3 - Update environment variables

1. Go back to Cloudflare Pages -> **Settings** -> **Environment variables**
2. Update all three variables to use the custom domain:

| Variable | Old value | New value |
|----------|-----------|-----------|
| `VITE_SUPABASE_REDIRECT_URL` | `https://munshee-pk-abc123.pages.dev/auth/callback` | `https://munshee.pk/auth/callback` |

3. Trigger a new deploy

### Step 8.4 - Update Supabase Auth

1. Go to Supabase -> **Authentication** -> **URL Configuration**
2. Update **Site URL** to `https://munshee.pk`
3. Add `https://munshee.pk/auth/callback` to **Redirect URLs**

> *(Screenshot: [ ])*

---

## 5.1 Re-scan Cron Secret (for UptimeRobot / external cron)

The `re-scan-business` edge function supports an external cron trigger via the `cron-rescan` companion function.

### Step 5.1.1 - Set the cron secret

In Supabase Dashboard, go to **Edge Functions** -> **Secrets** and add:

| Variable | Value |
|----------|-------|
| `RESCAN_CRON_SECRET` | A random 32-char string (e.g., generate with `openssl rand -hex 16`) |

### Step 5.1.2 - UptimeRobot monitor URL

Create a free UptimeRobot monitor:

| Field | Value |
|-------|-------|
| **Monitor Type** | HTTP(s) |
| **URL to Monitor** | `https://{your-project-ref}.supabase.co/functions/v1/cron-rescan` |
| **Method** | GET |
| **Custom Headers** | `X-Cron-Secret: {your-random-secret}` |
| **Monitoring Interval** | Every 5 minutes (free tier limit) |

Replace `{your-project-ref}` with your actual Supabase project reference ID.
Replace `{your-random-secret}` with the value you set in Step 5.1.1.

> **Why UptimeRobot?** Free tier allows 5-minute intervals. The edge function itself
> checks the rescan schedule and only processes businesses that are actually due,
> so frequent polling is harmless and ensures timely rescans.

> **Cadence per plan:**
> | Plan | Re-scan cadence |
> |------|-------------|
> | Free | Monthly |
> | Starter | Weekly |
> | Business / OS | Daily |

## Quick Reference

```
Pages build command:     pnpm cf:build
Pages output directory:  dist
Pages root directory:    /

Supabase Site URL:       https://munshee-pk-abc123.pages.dev
Supabase Redirect:       https://munshee-pk-abc123.pages.dev/auth/callback
Supabase Secret:         OPENROUTER_API_KEY

Env vars (Cloudflare Pages):
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  VITE_SUPABASE_REDIRECT_URL
```

---

*Last updated: 2026-09-08*
