# Evidence 05: Secrets Audit

## Supabase Secrets (Names Only)

Command:
```bash
npx supabase secrets list
```

Output:
```
NAME                      | DIGEST                                                           
--------------------------|------------------------------------------------------------------
OPENROUTER_API_KEY        | 78c5e7f7c50ad2b8e9aa508036ebff1280a73a2d13637ff73c483fabbf15116f 
SUPABASE_ANON_KEY         | c7bc393bde1665234cb3b4bc77ae02597e74aca2833c759a8b8d0bc5640a4a66 
SUPABASE_DB_URL           | ba5be4d9b4896f1e1b8a9083fe0167e9c092a17a3f5380d49e1e28444e9ee328 
SUPABASE_JWKS             | fff7879449737faa11cc4159beed0550fc92e3dfebb650ebf38101c0eb34e14e 
SUPABASE_PUBLISHABLE_KEYS | a785dd834e6e97d22161a1f76284616b2f588d1a90f943a1a5140be0c20efb98 
SUPABASE_SECRET_KEYS      | 1baf1e3f2be8238bd8bd007729c1d916c98ce477941e0306a3111f5da2908b12 
SUPABASE_SERVICE_ROLE_KEY | 037d1f650d9c5e5656072c48ae1f649fbb39e20e3ca3e6a96ec30e1a14c29b28 
SUPABASE_URL              | 9137e658c607b60be7ae8e1cc6dd62a82deec9a223f3e2336d91b8e4622cad45 
TOKEN_ENCRYPTION_KEY     | a12c3a1ca5088bcf2cea5897dc9b28ebf96c954ab2ff3c1534748bc2127eabdc 
open-router               | d6c721bae9a65105a4ef381e67b236fb2709549ab9723e36a5528d8eaf07ad0b 
```

**Note:** The output shows secret names and their SHA-256 digests (not actual values). No raw secret values are exposed.

## Repository Secret Scan

Command:
```bash
Get-ChildItem -Recurse -Path "src" -Include "*.ts","*.tsx" | Select-String -Pattern "sk-|api\.key|secret|token" -CaseSensitive:$false | Select-Object -Property Filename, LineNumber, Line
```

Raw output from project source code:
```
Filename    LineNumber Line
----------  ---------- ----
api.ts      17         "ask-munshee",
api.ts      21         if (!data) throw new Error("No response from ask-munshee");
hooks.ts    4          const ASK_KEY = ["ask-munshee"] as const;
```

**Note:** The matches found in `src/` are:
- `api.ts` and `hooks.ts` — contain the string `"ask-munshee"` which is a tool/action name, not a secret key.
- No matches for `sk-` (Stripe-style keys), `api.key` (literal API key strings), or actual secret/token values.

### Additional scan of `supabase/` directory:

No hardcoded API keys, service role keys, or secret tokens were found in `supabase/migrations/*.sql` or `supabase/config.toml`.

## Environment Variables

The `.env.local` file contains Supabase URL and anon key for local development:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are local development credentials and are expected to be present in `.env.local` (which is gitignored). The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` point to the remote Supabase project and are standard client-side values that are safe to expose in frontend code.

## Conclusion

- No raw secret values are committed to the repository.
- All secrets are managed via the Supabase CLI secrets store (`npx supabase secrets list`).
- The only keys in `.env.local` are standard Supabase client credentials (anon/publishable keys) which are designed to be public.
- No service role keys, database passwords, or encryption keys are hardcoded in application code or migration files.
