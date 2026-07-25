-- Minimal Supabase `auth` schema mock, used only by scripts/test-rls.sh to run
-- the real trip RLS policies/functions (supabase/migrations/*.sql) against a
-- disposable local Postgres cluster. Never apply this against a real Supabase
-- project -- the real `auth` schema already exists there.
create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

-- Mirrors the real auth.uid(): reads the JWT "sub" claim from the current
-- session/request. Tests impersonate a user with `set request.jwt.claim.sub`.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Non-superuser, non-owner role so RLS is actually enforced when we
-- `set role authenticated` (Postgres bypasses RLS for superusers/table owners).
drop role if exists authenticated;
create role authenticated nologin noinherit;
