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

-- Supabase ships this publication; a vanilla cluster does not, and the VJT-011
-- migration does `alter publication supabase_realtime add table ...`. Its
-- duplicate_object guard does not cover the publication being absent, so
-- create it here to let the real migrations replay unmodified.
do $$
begin
  create publication supabase_realtime;
exception when duplicate_object then null;
end $$;

-- Supabase's service_role, referenced by some migrations' grants.
do $$
begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null;
end $$;
