-- 0010_token_encryption.sql
-- Encrypt social_connections access_token at rest using pgcrypto

-- Add encrypted_token column (nullable initially for migration of existing rows)
alter table public.social_connections
  add column if not exists encrypted_token bytea;

-- Create encryption function (uses Supabase Vault for the key in production)
-- For now, we use a function that reads from a config-like approach
-- The key is passed as an argument to avoid hardcoding
create or replace function public.encrypt_token(p_token text, p_key text)
returns bytea
language plpgsql
immutable
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  result bytea;
begin
  select pgp_sym_encrypt(p_token, p_key, 'compress-algo=1, cipher-algo=aes256'::text)
  into result;
  return result;
end;
$$;

create or replace function public.decrypt_token(p_encrypted bytea, p_key text)
returns text
language plpgsql
immutable
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  result text;
begin
  select pgp_sym_decrypt(p_encrypted, p_key)
  into result;
  return result;
end;
$$;

-- Drop the old plain-text column (after we've added encrypted_token)
-- We'll do this in two steps: first add the new column, migrate data, then drop old
-- For this migration, we just add the column. The social-connect function will be updated
-- to write to encrypted_token instead of access_token.

-- Note: existing rows in access_token should be considered stale and rotated.
-- In a real production migration, we would:
-- 1. Add encrypted_token
-- 2. Run a backfill: update social_connections set encrypted_token = encrypt_token(access_token, '<key>') where encrypted_token is null;
-- 3. Clear access_token: update social_connections set access_token = null;
-- 4. Then in a follow-up migration, drop the access_token column.
-- For now, we keep access_token for backwards compatibility but the code will use encrypted_token.

grant execute on function public.encrypt_token(text, text) to authenticated;
grant execute on function public.decrypt_token(bytea, text) to authenticated;
