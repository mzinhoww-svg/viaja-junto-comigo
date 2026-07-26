-- Full-schema RLS audit (VJT-013 follow-up).
-- Run via `scripts/test-rls.sh --audit`.
--
-- Unlike rls_trip_invites.test.sql (which asserts and aborts on the first
-- failure), this file PROBES every product table and prints a report, so a
-- single run surfaces every policy gap at once instead of one per run.
--
-- For each table it asks, as a user who is NOT a member of the trip and NOT
-- the owner of the row: can I SELECT it? INSERT into it? UPDATE it? DELETE it?
-- Every answer is recorded, then compared against the expectation declared
-- in `expected` below. Public-by-design reads (checklist_templates,
-- paises_visto) are expected to be visible and are not leaks.
\set ON_ERROR_STOP on

grant usage on schema auth to authenticated;
grant execute on all functions in schema auth to authenticated;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- `anon` (visitante deslogado) recebe DE PROPÓSITO os mesmos grants amplos de
-- tabela que o Supabase concede por default no projeto real. Isso torna o
-- teste mais severo que produção: se alguma policy faltar, a RLS é a única
-- coisa entre o visitante e a linha, e a sonda enxerga o vazamento em vez de
-- ser barrada antes por falta de grant. Não confunda com o que a migration do
-- VJT-020 concede (só SELECT nas 7 tabelas do exemplo).
grant usage on schema auth to anon;
grant execute on all functions in schema auth to anon;
grant usage on schema public to anon;
grant all on all tables in schema public to anon;
grant execute on all functions in schema public to anon;

create table public.rls_audit_results (
  seq serial primary key,
  tabela text not null,
  op text not null,
  expected text not null,
  actual text not null
);
alter table public.rls_audit_results disable row level security;
grant all on public.rls_audit_results to authenticated;
grant usage, select on sequence public.rls_audit_results_seq_seq to authenticated;
grant all on public.rls_audit_results to anon;
grant usage, select on sequence public.rls_audit_results_seq_seq to anon;

-- SECURITY INVOKER on purpose: when `authenticated` calls this, the probed
-- statement runs as `authenticated`, so RLS applies exactly as it would to a
-- real client. Each probe is its own subtransaction, so a rejection does not
-- poison the session.
create or replace function public.rls_probe(
  p_tabela text, p_op text, p_expected text, p_sql text
) returns void language plpgsql security invoker as $fn$
declare
  v_actual text;
  v_count bigint;
  v_rows bigint;
begin
  begin
    if p_op = 'SELECT' then
      execute p_sql into v_count;
      v_actual := case when v_count = 0 then 'no rows' else 'VISIBLE (' || v_count || ' rows)' end;
    else
      execute p_sql;
      -- Critical: an UPDATE/DELETE that RLS filters down to nothing still
      -- "succeeds" -- it just touches 0 rows. Only a non-zero row count is a
      -- real write. For INSERT any row written is by definition a leak.
      get diagnostics v_rows = row_count;
      v_actual := case
        when v_rows = 0 then 'no rows'
        else 'ALLOWED (' || v_rows || ' rows)'
      end;
    end if;
  exception
    when insufficient_privilege then v_actual := 'blocked (RLS 42501)';
    when others then v_actual := 'blocked (' || sqlstate || ')';
  end;
  insert into public.rls_audit_results (tabela, op, expected, actual)
  values (p_tabela, p_op, p_expected, v_actual);
end $fn$;

\echo ''
\echo '=== seeding: owner A creates a trip and one row in every child table ==='
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- A: owner/member
  ('22222222-2222-2222-2222-222222222222'), -- B: legitimate editor member
  ('44444444-4444-4444-4444-444444444444'); -- D: outsider, member of nothing

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.trips (owner_id, destino_pais) values
  ('11111111-1111-1111-1111-111111111111', 'Estados Unidos') returning id as trip_id \gset
insert into public.trip_members (trip_id, user_id, role) values
  (:'trip_id', '11111111-1111-1111-1111-111111111111', 'owner');
insert into public.trip_invites (trip_id, created_by) values
  (:'trip_id', '11111111-1111-1111-1111-111111111111') returning token as member_token \gset

insert into public.budget_categories (trip_id, nome) values (:'trip_id', 'Passagens')
  returning id as category_id \gset
insert into public.budget_items (trip_id, category_id, nome, valor_estimado_brl_cents)
  values (:'trip_id', :'category_id', 'Voo GRU-MCO', 500000) returning id as item_id \gset
insert into public.savings_entries (trip_id, mes_ano, valor_brl_cents, created_by)
  values (:'trip_id', '2026-07-01', 100000, '11111111-1111-1111-1111-111111111111')
  returning id as saving_id \gset
insert into public.checklists (trip_id, tipo, nome) values (:'trip_id', 'documentos', 'Documentos')
  returning id as checklist_id \gset
insert into public.checklist_items (checklist_id, titulo) values (:'checklist_id', 'Passaporte')
  returning id as checklist_item_id \gset
insert into public.itinerary_days (trip_id, dia_numero) values (:'trip_id', 1)
  returning id as day_id \gset
insert into public.itinerary_slots (day_id, periodo, onde_ir) values (:'day_id', 'manha', 'Magic Kingdom')
  returning id as slot_id \gset
insert into public.ai_conversations (trip_id, created_by)
  values (:'trip_id', '11111111-1111-1111-1111-111111111111') returning id as conversation_id \gset
insert into public.ai_messages (conversation_id, role, content)
  values (:'conversation_id', 'user', 'Quanto custa a viagem?') returning id as message_id \gset
insert into public.ai_usage (user_id, mes_ano, msgs_count)
  values ('11111111-1111-1111-1111-111111111111', '2026-07-01', 3);
reset role;

-- entitlements has no INSERT policy at all (activation is service-role only),
-- so the owner's row is seeded as the table owner, not as `authenticated`.
insert into public.entitlements (user_id, plano, origem)
  values ('11111111-1111-1111-1111-111111111111', 'premium', 'manual');

\echo ''
\echo '=== probing as D: authenticated, but member of NOTHING and owner of NOTHING ==='
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

-- trips ---------------------------------------------------------------------
select public.rls_probe('trips', 'SELECT', 'no rows',
  format('select count(*) from public.trips where id = %L', :'trip_id'));
select public.rls_probe('trips', 'INSERT', 'blocked',
  format('insert into public.trips (owner_id, destino_pais) values (%L, %L)',
         '11111111-1111-1111-1111-111111111111', 'Sequestro de trip'));
select public.rls_probe('trips', 'UPDATE', 'no rows',
  format('update public.trips set nome = %L where id = %L', 'HACKED', :'trip_id'));
select public.rls_probe('trips', 'DELETE', 'no rows',
  format('delete from public.trips where id = %L', :'trip_id'));

-- trip_members --------------------------------------------------------------
select public.rls_probe('trip_members', 'SELECT', 'no rows',
  format('select count(*) from public.trip_members where trip_id = %L', :'trip_id'));
select public.rls_probe('trip_members', 'INSERT', 'blocked',
  format('insert into public.trip_members (trip_id, user_id, role) values (%L, %L, %L)',
         :'trip_id', '44444444-4444-4444-4444-444444444444', 'editor'));
select public.rls_probe('trip_members', 'DELETE', 'no rows',
  format('delete from public.trip_members where trip_id = %L', :'trip_id'));

-- trip_invites --------------------------------------------------------------
select public.rls_probe('trip_invites', 'SELECT', 'no rows',
  format('select count(*) from public.trip_invites where trip_id = %L', :'trip_id'));
select public.rls_probe('trip_invites', 'INSERT', 'blocked',
  format('insert into public.trip_invites (trip_id, created_by) values (%L, %L)',
         :'trip_id', '44444444-4444-4444-4444-444444444444'));
select public.rls_probe('trip_invites', 'DELETE', 'no rows',
  format('delete from public.trip_invites where trip_id = %L', :'trip_id'));

-- budget_categories ---------------------------------------------------------
select public.rls_probe('budget_categories', 'SELECT', 'no rows',
  format('select count(*) from public.budget_categories where trip_id = %L', :'trip_id'));
select public.rls_probe('budget_categories', 'INSERT', 'blocked',
  format('insert into public.budget_categories (trip_id, nome) values (%L, %L)', :'trip_id', 'X'));
select public.rls_probe('budget_categories', 'UPDATE', 'no rows',
  format('update public.budget_categories set nome = %L where trip_id = %L', 'HACKED', :'trip_id'));
select public.rls_probe('budget_categories', 'DELETE', 'no rows',
  format('delete from public.budget_categories where trip_id = %L', :'trip_id'));

-- budget_items --------------------------------------------------------------
select public.rls_probe('budget_items', 'SELECT', 'no rows',
  format('select count(*) from public.budget_items where trip_id = %L', :'trip_id'));
select public.rls_probe('budget_items', 'INSERT', 'blocked',
  format('insert into public.budget_items (trip_id, category_id, nome, valor_estimado_brl_cents) values (%L, %L, %L, 1)',
         :'trip_id', :'category_id', 'X'));
select public.rls_probe('budget_items', 'UPDATE', 'no rows',
  format('update public.budget_items set valor_pago_brl_cents = 999 where trip_id = %L', :'trip_id'));
select public.rls_probe('budget_items', 'DELETE', 'no rows',
  format('delete from public.budget_items where trip_id = %L', :'trip_id'));

-- savings_entries -----------------------------------------------------------
select public.rls_probe('savings_entries', 'SELECT', 'no rows',
  format('select count(*) from public.savings_entries where trip_id = %L', :'trip_id'));
select public.rls_probe('savings_entries', 'INSERT', 'blocked',
  format('insert into public.savings_entries (trip_id, mes_ano, valor_brl_cents, created_by) values (%L, %L, 1, %L)',
         :'trip_id', '2026-08-01', '44444444-4444-4444-4444-444444444444'));
select public.rls_probe('savings_entries', 'UPDATE', 'no rows',
  format('update public.savings_entries set valor_brl_cents = 1 where trip_id = %L', :'trip_id'));
select public.rls_probe('savings_entries', 'DELETE', 'no rows',
  format('delete from public.savings_entries where trip_id = %L', :'trip_id'));

-- checklists ----------------------------------------------------------------
select public.rls_probe('checklists', 'SELECT', 'no rows',
  format('select count(*) from public.checklists where trip_id = %L', :'trip_id'));
select public.rls_probe('checklists', 'INSERT', 'blocked',
  format('insert into public.checklists (trip_id, tipo, nome) values (%L, %L, %L)', :'trip_id', 'mala', 'X'));
select public.rls_probe('checklists', 'UPDATE', 'no rows',
  format('update public.checklists set nome = %L where trip_id = %L', 'HACKED', :'trip_id'));
select public.rls_probe('checklists', 'DELETE', 'no rows',
  format('delete from public.checklists where trip_id = %L', :'trip_id'));

-- checklist_items (nested: policy resolves trip via checklists) --------------
select public.rls_probe('checklist_items', 'SELECT', 'no rows',
  format('select count(*) from public.checklist_items where checklist_id = %L', :'checklist_id'));
select public.rls_probe('checklist_items', 'INSERT', 'blocked',
  format('insert into public.checklist_items (checklist_id, titulo) values (%L, %L)', :'checklist_id', 'X'));
select public.rls_probe('checklist_items', 'UPDATE', 'no rows',
  format('update public.checklist_items set done = true where checklist_id = %L', :'checklist_id'));
select public.rls_probe('checklist_items', 'DELETE', 'no rows',
  format('delete from public.checklist_items where checklist_id = %L', :'checklist_id'));

-- itinerary_days ------------------------------------------------------------
select public.rls_probe('itinerary_days', 'SELECT', 'no rows',
  format('select count(*) from public.itinerary_days where trip_id = %L', :'trip_id'));
select public.rls_probe('itinerary_days', 'INSERT', 'blocked',
  format('insert into public.itinerary_days (trip_id, dia_numero) values (%L, 99)', :'trip_id'));
select public.rls_probe('itinerary_days', 'UPDATE', 'no rows',
  format('update public.itinerary_days set dia_numero = 42 where trip_id = %L', :'trip_id'));
select public.rls_probe('itinerary_days', 'DELETE', 'no rows',
  format('delete from public.itinerary_days where trip_id = %L', :'trip_id'));

-- itinerary_slots (nested: policy resolves trip via itinerary_days) ----------
select public.rls_probe('itinerary_slots', 'SELECT', 'no rows',
  format('select count(*) from public.itinerary_slots where day_id = %L', :'day_id'));
select public.rls_probe('itinerary_slots', 'INSERT', 'blocked',
  format('insert into public.itinerary_slots (day_id, periodo, onde_ir) values (%L, %L, %L)',
         :'day_id', 'noite', 'X'));
select public.rls_probe('itinerary_slots', 'UPDATE', 'no rows',
  format('update public.itinerary_slots set onde_ir = %L where day_id = %L', 'HACKED', :'day_id'));
select public.rls_probe('itinerary_slots', 'DELETE', 'no rows',
  format('delete from public.itinerary_slots where day_id = %L', :'day_id'));

-- ai_conversations ----------------------------------------------------------
select public.rls_probe('ai_conversations', 'SELECT', 'no rows',
  format('select count(*) from public.ai_conversations where trip_id = %L', :'trip_id'));
select public.rls_probe('ai_conversations', 'INSERT', 'blocked',
  format('insert into public.ai_conversations (trip_id, created_by) values (%L, %L)',
         :'trip_id', '44444444-4444-4444-4444-444444444444'));
select public.rls_probe('ai_conversations', 'DELETE', 'no rows',
  format('delete from public.ai_conversations where trip_id = %L', :'trip_id'));

-- ai_messages (nested: policy resolves trip via ai_conversations) -----------
select public.rls_probe('ai_messages', 'SELECT', 'no rows',
  format('select count(*) from public.ai_messages where conversation_id = %L', :'conversation_id'));
select public.rls_probe('ai_messages', 'INSERT', 'blocked',
  format('insert into public.ai_messages (conversation_id, role, content) values (%L, %L, %L)',
         :'conversation_id', 'user', 'X'));
select public.rls_probe('ai_messages', 'UPDATE', 'no rows',
  format('update public.ai_messages set content = %L where conversation_id = %L', 'HACKED', :'conversation_id'));
select public.rls_probe('ai_messages', 'DELETE', 'no rows',
  format('delete from public.ai_messages where conversation_id = %L', :'conversation_id'));

-- ai_usage (per-user, not per-trip) -----------------------------------------
select public.rls_probe('ai_usage', 'SELECT', 'no rows',
  format('select count(*) from public.ai_usage where user_id = %L', '11111111-1111-1111-1111-111111111111'));
select public.rls_probe('ai_usage', 'INSERT', 'blocked',
  format('insert into public.ai_usage (user_id, mes_ano, msgs_count) values (%L, %L, 0)',
         '11111111-1111-1111-1111-111111111111', '2026-09-01'));
select public.rls_probe('ai_usage', 'UPDATE', 'no rows',
  format('update public.ai_usage set msgs_count = 0 where user_id = %L', '11111111-1111-1111-1111-111111111111'));
select public.rls_probe('ai_usage', 'DELETE', 'no rows',
  format('delete from public.ai_usage where user_id = %L', '11111111-1111-1111-1111-111111111111'));

-- entitlements (per-user; select-own only, no write policy at all) -----------
select public.rls_probe('entitlements', 'SELECT', 'no rows',
  format('select count(*) from public.entitlements where user_id = %L', '11111111-1111-1111-1111-111111111111'));
select public.rls_probe('entitlements', 'INSERT (self-grant premium!)', 'blocked',
  format('insert into public.entitlements (user_id, plano, origem) values (%L, %L, %L)',
         '44444444-4444-4444-4444-444444444444', 'premium', 'manual'));
select public.rls_probe('entitlements', 'UPDATE', 'no rows',
  format('update public.entitlements set plano = %L where user_id = %L', 'free',
         '11111111-1111-1111-1111-111111111111'));
select public.rls_probe('entitlements', 'DELETE', 'no rows',
  format('delete from public.entitlements where user_id = %L', '11111111-1111-1111-1111-111111111111'));

-- public-by-design catalogs: reads SHOULD be visible; writes must be blocked -
select public.rls_probe('checklist_templates', 'SELECT', 'VISIBLE (public by design)',
  'select count(*) from public.checklist_templates');
select public.rls_probe('checklist_templates', 'INSERT', 'blocked',
  format('insert into public.checklist_templates (tipo, titulo) values (%L, %L)', 'mala', 'X'));
select public.rls_probe('checklist_templates', 'UPDATE', 'blocked',
  format('update public.checklist_templates set titulo = %L', 'HACKED'));
select public.rls_probe('checklist_templates', 'DELETE', 'blocked',
  'delete from public.checklist_templates');

select public.rls_probe('paises_visto', 'SELECT', 'VISIBLE (public by design)',
  'select count(*) from public.paises_visto');
select public.rls_probe('paises_visto', 'INSERT', 'blocked',
  format('insert into public.paises_visto (pais_iso, pais_nome, exige_visto_br) values (%L, %L, true)', 'ZZ', 'X'));
select public.rls_probe('paises_visto', 'UPDATE', 'blocked',
  format('update public.paises_visto set exige_visto_br = false'));
select public.rls_probe('paises_visto', 'DELETE', 'blocked',
  'delete from public.paises_visto');

reset role;

\echo ''
\echo '=== probing as B: a LEGITIMATE editor member attempting privilege escalation ==='
-- B joins the trip the supported way (accepting the invite), so every probe
-- below starts from real, granted access -- these ask what a member can
-- escalate to, not what an outsider can reach.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.accept_trip_invite(:'member_token') as joined \gset

-- The escalation this migration closes: owner_id must be frozen against
-- members. Left open, an editor self-assigns owner_id and (because
-- trips_select now also matches on owner_id) keeps reading the trips row
-- forever, including after leaving the trip.
select public.rls_probe('trips [as member]', 'UPDATE owner_id (escalation)', 'blocked',
  format('update public.trips set owner_id = %L where id = %L',
         '22222222-2222-2222-2222-222222222222', :'trip_id'));

-- Guardrail: freezing owner_id must not break the everyday member writes
-- that VJT-004 and VJT-006 depend on.
select public.rls_probe('trips [as member]', 'UPDATE nome (legit, VJT-004)', 'ALLOWED (legit)',
  format('update public.trips set nome = %L where id = %L', 'Renomeada', :'trip_id'));
select public.rls_probe('trips [as member]', 'UPDATE data/status (legit, VJT-004)', 'ALLOWED (legit)',
  format('update public.trips set data_viagem = %L, status = %L where id = %L',
         '2027-01-15', 'planejando', :'trip_id'));
select public.rls_probe('trips [as member]', 'UPDATE cambio (legit, VJT-006)', 'ALLOWED (legit)',
  format('update public.trips set cambio_manual = 5.43, moeda_destino = %L where id = %L',
         'USD', :'trip_id'));
reset role;

\echo ''
\echo '=== VJT-020: seeding a TEMPLATE trip (owner C) alongside A normal trip ==='
-- A trip de A (acima) permanece NORMAL e vira o controle negativo: toda sonda
-- pública abaixo é feita em par -- uma na trip template, outra na trip de A --
-- para que "o anon enxerga" seja provado junto de "o anon não enxerga o resto".
-- Sem o par, um SELECT público quebrado que devolvesse tudo passaria batido.
insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333');

-- Semeada como dona da tabela, e não via `set role authenticated`, porque a
-- policy trips_insert do VJT-020 barra `is_template = true` vindo de usuário
-- -- que é exatamente o comportamento desejado e é sondado mais abaixo.
insert into public.trips (owner_id, destino_pais, destino_cidade, is_template)
  values ('33333333-3333-3333-3333-333333333333', 'Estados Unidos', 'Orlando', true)
  returning id as tpl_id \gset
insert into public.trip_members (trip_id, user_id, role)
  values (:'tpl_id', '33333333-3333-3333-3333-333333333333', 'owner');
insert into public.budget_categories (trip_id, nome) values (:'tpl_id', 'Parques')
  returning id as tpl_category_id \gset
insert into public.budget_items (trip_id, category_id, nome, valor_estimado_brl_cents, valor_pago_brl_cents)
  values (:'tpl_id', :'tpl_category_id', 'Ingressos Disney', 900000, 400000)
  returning id as tpl_item_id \gset
insert into public.savings_entries (trip_id, mes_ano, valor_brl_cents, created_by)
  values (:'tpl_id', '2026-07-01', 250000, '33333333-3333-3333-3333-333333333333');
insert into public.checklists (trip_id, tipo, nome) values (:'tpl_id', 'documentos', 'Documentos')
  returning id as tpl_checklist_id \gset
insert into public.checklist_items (checklist_id, titulo, done)
  values (:'tpl_checklist_id', 'Passaporte', true);
insert into public.itinerary_days (trip_id, dia_numero) values (:'tpl_id', 1)
  returning id as tpl_day_id \gset
insert into public.itinerary_slots (day_id, periodo, onde_ir)
  values (:'tpl_day_id', 'manha', 'Magic Kingdom');

\echo ''
\echo '=== probing as ANON (deslogado): template must be visible, everything else must not ==='
set role anon;
-- auth.uid() lê este GUC; sem zerá-lo o `anon` herdaria o sub do bloco
-- anterior e o teste mediria um usuário logado achando que mede um visitante.
set request.jwt.claim.sub = '';

-- --- lado positivo: a viagem exemplo e suas 6 filhas ---
select public.rls_probe('trips [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.trips where id = %L', :'tpl_id'));
select public.rls_probe('budget_categories [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.budget_categories where trip_id = %L', :'tpl_id'));
select public.rls_probe('budget_items [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.budget_items where trip_id = %L', :'tpl_id'));
select public.rls_probe('checklists [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.checklists where trip_id = %L', :'tpl_id'));
select public.rls_probe('checklist_items [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.checklist_items where checklist_id = %L', :'tpl_checklist_id'));
select public.rls_probe('itinerary_days [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.itinerary_days where trip_id = %L', :'tpl_id'));
select public.rls_probe('itinerary_slots [anon/template]', 'SELECT', 'VISIBLE (public by design)',
  format('select count(*) from public.itinerary_slots where day_id = %L', :'tpl_day_id'));

-- --- CONTROLE NEGATIVO: a trip normal de A, tabela por tabela ---
-- Se a abertura pública tivesse vazado (ex.: `using (true)` no lugar de
-- `using (is_template)`), é aqui que aparece.
select public.rls_probe('trips [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.trips where id = %L', :'trip_id'));
select public.rls_probe('budget_categories [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.budget_categories where trip_id = %L', :'trip_id'));
select public.rls_probe('budget_items [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.budget_items where trip_id = %L', :'trip_id'));
select public.rls_probe('checklists [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.checklists where trip_id = %L', :'trip_id'));
select public.rls_probe('checklist_items [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.checklist_items where checklist_id = %L', :'checklist_id'));
select public.rls_probe('itinerary_days [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.itinerary_days where trip_id = %L', :'trip_id'));
select public.rls_probe('itinerary_slots [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.itinerary_slots where day_id = %L', :'day_id'));
select public.rls_probe('trip_members [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.trip_members where trip_id = %L', :'trip_id'));
select public.rls_probe('trip_invites [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.trip_invites where trip_id = %L', :'trip_id'));
select public.rls_probe('entitlements [anon/CONTROLE]', 'SELECT', 'no rows',
  'select count(*) from public.entitlements');
select public.rls_probe('ai_messages [anon/CONTROLE]', 'SELECT', 'no rows',
  'select count(*) from public.ai_messages');

-- --- savings_entries: fora da abertura pública, inclusive na trip template ---
-- É a única tabela do conjunto que carrega identidade (`created_by`).
select public.rls_probe('savings_entries [anon/template]', 'SELECT', 'no rows',
  format('select count(*) from public.savings_entries where trip_id = %L', :'tpl_id'));
select public.rls_probe('savings_entries [anon/CONTROLE]', 'SELECT', 'no rows',
  format('select count(*) from public.savings_entries where trip_id = %L', :'trip_id'));

-- --- escrita: a abertura é de leitura, e só ---
select public.rls_probe('trips [anon/template]', 'UPDATE', 'no rows',
  format('update public.trips set nome = %L where id = %L', 'HACKED', :'tpl_id'));
select public.rls_probe('trips [anon/template]', 'DELETE', 'no rows',
  format('delete from public.trips where id = %L', :'tpl_id'));
select public.rls_probe('trips [anon]', 'INSERT', 'blocked',
  format('insert into public.trips (owner_id, destino_pais) values (%L, %L)',
         '33333333-3333-3333-3333-333333333333', 'Trip do visitante'));
select public.rls_probe('budget_items [anon/template]', 'UPDATE', 'no rows',
  format('update public.budget_items set valor_pago_brl_cents = 1 where trip_id = %L', :'tpl_id'));
select public.rls_probe('budget_items [anon/template]', 'INSERT', 'blocked',
  format('insert into public.budget_items (trip_id, category_id, nome, valor_estimado_brl_cents) values (%L, %L, %L, 1)',
         :'tpl_id', :'tpl_category_id', 'X'));
select public.rls_probe('checklist_items [anon/template]', 'UPDATE', 'no rows',
  format('update public.checklist_items set done = false where checklist_id = %L', :'tpl_checklist_id'));
select public.rls_probe('checklist_items [anon/template]', 'DELETE', 'no rows',
  format('delete from public.checklist_items where checklist_id = %L', :'tpl_checklist_id'));
select public.rls_probe('itinerary_slots [anon/template]', 'UPDATE', 'no rows',
  format('update public.itinerary_slots set onde_ir = %L where day_id = %L', 'HACKED', :'tpl_day_id'));

-- --- clonar exige sessão ---
select public.rls_probe('clone_template_trip [anon]', 'EXECUTE', 'blocked',
  format('select public.clone_template_trip(%L)', :'tpl_id'));

reset role;

\echo ''
\echo '=== VJT-020: publicar a própria trip é ESCRITA, e continua barrada ==='
-- `is_template` virou load-bearing para leitura pública, então um membro que
-- consiga gravá-la publica os dados da viagem para a internet inteira. Mesma
-- lição do VJT-013 com `owner_id` -- e mesma sonda.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.rls_probe('trips [as owner]', 'UPDATE is_template (publicação!)', 'no rows',
  format('update public.trips set is_template = true where id = %L', :'trip_id'));
select public.rls_probe('trips [as owner]', 'INSERT is_template (publicação!)', 'blocked',
  format('insert into public.trips (owner_id, destino_pais, is_template) values (%L, %L, true)',
         '11111111-1111-1111-1111-111111111111', 'Trip auto-publicada'));
select public.rls_probe('trips [as owner]', 'UPDATE nome (legit, regressão)', 'ALLOWED (legit)',
  format('update public.trips set nome = %L where id = %L', 'Ainda edito a minha', :'trip_id'));
reset role;

-- Membro apenas EDITOR da trip de A: não pode publicar a viagem de outra
-- pessoa (o caso pior, porque expõe dado que nem é dele).
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.rls_probe('trips [as editor]', 'UPDATE is_template (publicação alheia!)', 'no rows',
  format('update public.trips set is_template = true where id = %L', :'trip_id'));
reset role;

\echo ''
\echo '=== VJT-020: clonagem (conteúdo + idempotência), como usuário logado D ==='
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select public.clone_template_trip(:'tpl_id') as clone_1 \gset
select public.clone_template_trip(:'tpl_id') as clone_2 \gset

insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'idempotência (2 chamadas)', '= mesmo uuid',
  case when :'clone_1' = :'clone_2' then '= mesmo uuid' else '= DUPLICOU' end;

insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'owner + is_template do clone', '= owner=D, template=false',
  case when t.owner_id = '44444444-4444-4444-4444-444444444444' and not t.is_template
            and t.cloned_from_template_id = :'tpl_id'
       then '= owner=D, template=false' else '= ERRADO' end
  from public.trips t where t.id = :'clone_1';

insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'filhas clonadas (cat/item/lista/item/dia/slot)', '= 1/1/1/1/1/1',
  '= ' || (select count(*) from public.budget_categories where trip_id = :'clone_1')
  || '/' || (select count(*) from public.budget_items where trip_id = :'clone_1')
  || '/' || (select count(*) from public.checklists where trip_id = :'clone_1')
  || '/' || (select count(*) from public.checklist_items ci
               join public.checklists c on c.id = ci.checklist_id where c.trip_id = :'clone_1')
  || '/' || (select count(*) from public.itinerary_days where trip_id = :'clone_1')
  || '/' || (select count(*) from public.itinerary_slots s
               join public.itinerary_days d on d.id = s.day_id where d.trip_id = :'clone_1');

-- Decisão 2 do ticket: vem o plano, não o progresso. O template tem 1 item
-- marcado e R$ 4.000 pagos; o clone tem que nascer zerado nos dois.
insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'progresso zerado (done / valor_pago)', '= 0 done, 0 pago',
  '= ' || (select count(*) from public.checklist_items ci
             join public.checklists c on c.id = ci.checklist_id
            where c.trip_id = :'clone_1' and ci.done) || ' done, '
       || (select coalesce(sum(valor_pago_brl_cents + valor_pago_destino_cents), 0)
             from public.budget_items where trip_id = :'clone_1') || ' pago';

-- O clone não pode arrastar as economias do dono do template (identidade).
insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'savings NÃO clonadas', '= 0 linhas',
  '= ' || (select count(*) from public.savings_entries where trip_id = :'clone_1') || ' linhas';

-- Estimativas SIM: é o conteúdo que faz o exemplo valer.
insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'estimativa preservada', '= 900000',
  '= ' || (select coalesce(sum(valor_estimado_brl_cents), 0)::text
             from public.budget_items where trip_id = :'clone_1');

-- Categoria do item clonado tem que apontar para a categoria NOVA, não para a
-- do template -- o erro clássico de clonagem com id mapeado errado.
insert into public.rls_audit_results (tabela, op, expected, actual)
select 'clone_template_trip', 'FK do item aponta para a categoria do clone', '= sim',
  case when exists (
    select 1 from public.budget_items bi
      join public.budget_categories bc on bc.id = bi.category_id
     where bi.trip_id = :'clone_1' and bc.trip_id = :'clone_1'
  ) and not exists (
    select 1 from public.budget_items bi
     where bi.trip_id = :'clone_1' and bi.category_id = :'tpl_category_id'
  ) then '= sim' else '= NÃO (vazou id do template)' end;

-- Clonar o que não é template não pode funcionar: seria uma via de cópia da
-- viagem privada de qualquer pessoa cujo uuid vazasse.
select public.rls_probe('clone_template_trip [trip normal]', 'EXECUTE', 'blocked',
  format('select public.clone_template_trip(%L)', :'trip_id'));

reset role;

\echo ''
\echo '================== RLS AUDIT REPORT =================='
\pset format aligned
select
  tabela,
  op,
  expected,
  actual,
  case
    -- Asserções de igualdade literal (VJT-020: idempotência e conteúdo da
    -- clonagem). Marcadas com o prefixo `= ` para não colidirem com as
    -- famílias de expectativa acima, que são sobre visibilidade.
    when expected like '= %' and actual = expected then 'ok'
    when expected like '= %' then '!! MISMATCH'
    -- Writes that SHOULD succeed (a member editing their own trip): the
    -- regression guard for hardening policies too far.
    when expected = 'ALLOWED (legit)' and actual like 'ALLOWED%' then 'ok'
    when expected = 'ALLOWED (legit)' then '!! LEGIT WRITE BROKEN'
    -- Any other row actually written/changed/removed is a leak, whether the
    -- probe expected an outright block (INSERT) or a zero-row result because
    -- RLS should have filtered the target away (UPDATE/DELETE).
    when actual like 'ALLOWED%' then '*** LEAK ***'
    -- Rows visible to an outsider are a leak unless the table is public catalog.
    when expected = 'no rows' and actual like 'VISIBLE%' then '*** LEAK ***'
    when expected like 'VISIBLE%' and actual not like 'VISIBLE%' then '!! unexpected block'
    else 'ok'
  end as veredito
from public.rls_audit_results
order by seq;

\echo ''
\echo '=== summary ==='
select
  count(*) filter (where expected <> 'ALLOWED (legit)' and actual like 'ALLOWED%')
  + count(*) filter (where expected = 'no rows' and actual like 'VISIBLE%') as leaks,
  count(*) filter (where expected like 'VISIBLE (public%' and actual not like 'VISIBLE%')
  + count(*) filter (where expected = 'ALLOWED (legit)' and actual not like 'ALLOWED%')
  + count(*) filter (where expected like '= %' and actual <> expected) as broken,
  count(*) as total_probes
from public.rls_audit_results;

-- Exit non-zero when anything is wrong, so `--audit` is usable as a gate and
-- not just a report someone has to read carefully.
--
-- A DO block, not `case when ... then 1 else 1/0 end`: Postgres constant-folds
-- the 1/0 arm at plan time even when CASE would never select it, so that
-- idiom aborts unconditionally here. (It is safe in
-- rls_trip_invites.test.sql, where psql substitutes literals and the whole
-- CASE folds to its true arm.) No psql :variables are referenced inside this
-- block, so dollar-quoting is safe.
do $audit$
declare v_bad bigint;
begin
  select
    count(*) filter (where expected <> 'ALLOWED (legit)' and actual like 'ALLOWED%')
    + count(*) filter (where expected = 'no rows' and actual like 'VISIBLE%')
    + count(*) filter (where expected like 'VISIBLE (public%' and actual not like 'VISIBLE%')
    + count(*) filter (where expected = 'ALLOWED (legit)' and actual not like 'ALLOWED%')
    + count(*) filter (where expected like '= %' and actual <> expected)
  into v_bad
  from public.rls_audit_results;

  if v_bad > 0 then
    raise exception 'RLS audit FAILED: % problem(s) -- see the veredito column above', v_bad;
  end if;
  raise notice 'AUDIT CLEAN: no leaks, no broken legitimate writes';
end
$audit$;
