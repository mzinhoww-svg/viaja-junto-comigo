-- RLS regression test for VJT-013 (convites e membros).
-- Run via scripts/test-rls.sh against a disposable local Postgres cluster
-- that already has supabase/tests/fixtures/auth_mock.sql and the real
-- supabase/migrations/20260723120000_viajaly_trip_initial_schema.sql and
-- 20260725200000_vjt013_trips_select_owner_bootstrap.sql applied.
--
-- Proves, against the REAL policies/RPC (not a reimplementation):
--   0. The trip-creation bootstrap (INSERT ... RETURNING on trips, then the
--      owner's first trip_members row) succeeds for a brand-new trip -- this
--      is the exact sequence useCreateTrip.ts runs, and it deadlocked on
--      RLS before the 20260725200000 migration (see that file for why).
--   1. A non-member cannot read a trip, its members, or its invites.
--   2. A non-member cannot insert trip-scoped data (budget_categories).
--   3. accept_trip_invite() turns an invitee into a member, who can then read.
--   4. An already-accepted invite cannot be reused.
--   5. An expired invite cannot be accepted.
--
-- Assertions avoid `do $$ ... $$` blocks on purpose: psql does not
-- interpolate `:variables` inside dollar-quoted strings (it would collide
-- with plpgsql's `:=` assignment operator), so every check here is a
-- top-level `select case when <condition> then 1 else 1/0 end` -- a false
-- condition raises a real division-by-zero error, which aborts the script
-- under ON_ERROR_STOP. Expected-to-fail statements toggle ON_ERROR_STOP off
-- and assert psql's own `:ERROR`/`:SQLSTATE` special variables instead.
\set ON_ERROR_STOP on

-- Grants for `authenticated` must run after the migration creates the tables.
grant usage on schema auth to authenticated;
grant execute on all functions in schema auth to authenticated;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

\echo '--- scenario 0: owner (A) creates a trip and its own owner membership (useCreateTrip.ts flow) ---'
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- A: owner
  ('22222222-2222-2222-2222-222222222222'), -- B: invitee / non-member
  ('33333333-3333-3333-3333-333333333333'); -- C: second outsider

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.trips (owner_id, destino_pais) values
  ('11111111-1111-1111-1111-111111111111', 'Estados Unidos')
  returning id as trip_id \gset

insert into public.trip_members (trip_id, user_id, role) values
  (:'trip_id', '11111111-1111-1111-1111-111111111111', 'owner');

\echo 'OK: owner can create a trip and its own membership row'

\echo '--- fixture: owner (A) creates an invite ---'
insert into public.trip_invites (trip_id, created_by) values
  (:'trip_id', '11111111-1111-1111-1111-111111111111')
  returning token \gset

reset role;

\echo '--- scenario 1: non-member (B) cannot read the trip, its members, or its invites ---'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select
  (select count(*) from public.trips where id = :'trip_id') as cnt_trips,
  (select count(*) from public.trip_members where trip_id = :'trip_id') as cnt_members,
  (select count(*) from public.trip_invites where trip_id = :'trip_id') as cnt_invites
\gset

select case when :cnt_trips = 0 then 1 else 1/0 end as assert_trips_hidden;
select case when :cnt_members = 0 then 1 else 1/0 end as assert_members_hidden;
select case when :cnt_invites = 0 then 1 else 1/0 end as assert_invites_hidden;
\echo 'OK: non-member sees zero rows across trips/trip_members/trip_invites'

\echo '--- scenario 2: non-member (B) cannot insert trip-scoped data (budget_categories) ---'
\set ON_ERROR_STOP off
insert into public.budget_categories (trip_id, nome) values (:'trip_id', 'Transporte');
\set ON_ERROR_STOP on
select case when :'ERROR' = 'true' and :'SQLSTATE' = '42501' then 1 else 1/0 end as assert_insert_blocked_by_rls;
\echo 'OK: non-member insert blocked by RLS (SQLSTATE 42501)'

reset role;

\echo '--- scenario 3: B accepts the invite via accept_trip_invite() and becomes a member ---'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.accept_trip_invite(:'token') as accepted_trip_id \gset
select case when :'accepted_trip_id' = :'trip_id' then 1 else 1/0 end as assert_returned_trip_id;

select
  (select count(*) from public.trips where id = :'trip_id') as cnt_trips_visible,
  (select count(*) from public.trip_members
    where trip_id = :'trip_id'
      and user_id = '22222222-2222-2222-2222-222222222222'
      and role = 'editor') as cnt_b_member
\gset

select case when :cnt_trips_visible = 1 then 1 else 1/0 end as assert_trip_now_visible;
select case when :cnt_b_member = 1 then 1 else 1/0 end as assert_b_is_editor_member;
\echo 'OK: B is now a member and can read the trip'

reset role;

\echo '--- scenario 4: an already-accepted invite cannot be reused ---'
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

\set ON_ERROR_STOP off
select public.accept_trip_invite(:'token');
\set ON_ERROR_STOP on
select case when :'ERROR' = 'true' and :'SQLSTATE' = 'P0001' then 1 else 1/0 end as assert_reuse_rejected;
\echo 'OK: reuse correctly rejected (SQLSTATE P0001, invite_invalid)'

reset role;

\echo '--- scenario 5: an expired invite cannot be accepted ---'
-- Backdating is admin-only test fixture setup, not an exercise of invites_insert.
insert into public.trip_invites (trip_id, created_by, expires_at) values
  (:'trip_id', '11111111-1111-1111-1111-111111111111', now() - interval '1 day')
  returning token as expired_token \gset

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

\set ON_ERROR_STOP off
select public.accept_trip_invite(:'expired_token');
\set ON_ERROR_STOP on
select case when :'ERROR' = 'true' and :'SQLSTATE' = 'P0001' then 1 else 1/0 end as assert_expired_rejected;
\echo 'OK: expired invite correctly rejected (SQLSTATE P0001, invite_invalid)'

reset role;
\echo '=== ALL RLS ASSERTIONS PASSED ==='
