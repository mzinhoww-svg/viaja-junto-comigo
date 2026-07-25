-- RLS + estrutura do log de consentimento LGPD (VJT-017b, issue #65).
-- Rodar via `scripts/test-rls.sh --lgpd`, contra um cluster Postgres
-- descartável que já tem o auth_mock, o schema inicial, a migration do
-- VJT-017 (que cria `user_lgpd_consents`) e a do VJT-017b (que a transforma
-- em log append-only) aplicados.
--
-- Prova, contra as policies e constraints REAIS (não uma reimplementação):
--   1. O mesmo usuário consegue registrar MAIS DE UM aceite (v1 e depois
--      v2) — era exatamente isso que a PK em `user_id` impedia.
--   2. O aceite antigo continua íntegro depois do novo (histórico preservado,
--      com o `aceito_em` original).
--   3. Aceitar a mesma versão duas vezes é bloqueado pela unique
--      (user_id, versao_termos) — idempotência, o client trata 23505 como
--      sucesso.
--   4. Append-only na prática: nem UPDATE nem DELETE do próprio aceite
--      passam, porque a tabela não tem policy para essas operações.
--   5. Um usuário não enxerga (nem grava) o consentimento de outro.
--
-- Mesmo padrão de asserção do rls_trip_invites.test.sql: `select case when
-- <condição> then 1 else 1/0 end` aborta o script sob ON_ERROR_STOP quando a
-- condição é falsa; statements que DEVEM falhar desligam ON_ERROR_STOP e
-- checam `:ERROR`/`:SQLSTATE`.
\set ON_ERROR_STOP on

grant usage on schema auth to authenticated;
grant execute on all functions in schema auth to authenticated;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- A: aceitou v1 antes do bump
  ('22222222-2222-2222-2222-222222222222'); -- B: outro usuário

\echo '--- cenario 1: A aceita v1 e, depois do bump, tambem v2 (duas linhas p/ o mesmo usuario) ---'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- `aceito_em` explícito só aqui, para provar no cenário 2 que a linha antiga
-- não foi tocada; no produto o default `now()` é quem preenche.
insert into public.user_lgpd_consents (user_id, versao_termos, aceito_em) values
  ('11111111-1111-1111-1111-111111111111', 'v1', '2026-07-20T10:00:00Z');

insert into public.user_lgpd_consents (user_id, versao_termos) values
  ('11111111-1111-1111-1111-111111111111', 'v2');

select count(*) as cnt_a from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111' \gset
select case when :cnt_a = 2 then 1 else 1/0 end as assert_duas_linhas;
\echo 'OK: o mesmo usuario tem duas versoes aceitas (a PK em user_id nao existe mais)'

\echo '--- cenario 2: o aceite antigo continua intacto (historico preservado) ---'
select count(*) as cnt_v1_intacto from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111'
    and versao_termos = 'v1'
    and aceito_em = '2026-07-20T10:00:00Z' \gset
select case when :cnt_v1_intacto = 1 then 1 else 1/0 end as assert_v1_intacto;

-- E a leitura que o gate faz (mais recente primeiro) devolve a versão nova no topo.
select versao_termos as versao_topo from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111'
  order by aceito_em desc limit 1 \gset
select case when :'versao_topo' = 'v2' then 1 else 1/0 end as assert_topo_e_v2;
\echo 'OK: aceite v1 preservado com o timestamp original; v2 e o mais recente'

\echo '--- cenario 3: aceitar a MESMA versao duas vezes viola a unique (23505) ---'
\set ON_ERROR_STOP off
insert into public.user_lgpd_consents (user_id, versao_termos) values
  ('11111111-1111-1111-1111-111111111111', 'v2');
\set ON_ERROR_STOP on
select case when :'ERROR' = 'true' and :'SQLSTATE' = '23505' then 1 else 1/0 end as assert_unique;
\echo 'OK: duplicata da mesma versao rejeitada pela unique (user_id, versao_termos)'

\echo '--- cenario 4: append-only — nem UPDATE nem DELETE do proprio aceite passam ---'
-- Sem policy de UPDATE/DELETE, o Postgres não levanta 42501: ele filtra as
-- linhas pelo USING inexistente, então o statement "tem sucesso" tocando
-- ZERO linhas (mesma leitura do rls_full_schema_audit.sql). Só uma contagem
-- de linhas afetadas distingue "bloqueado" de "passou" aqui.
update public.user_lgpd_consents set versao_termos = 'v3'
  where user_id = '11111111-1111-1111-1111-111111111111';
select case when :ROW_COUNT = 0 then 1 else 1/0 end as assert_update_nao_toca_nada;

delete from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111';
select case when :ROW_COUNT = 0 then 1 else 1/0 end as assert_delete_nao_toca_nada;

select count(*) as cnt_apos from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111' \gset
select count(*) as cnt_v1_pos from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111'
    and versao_termos = 'v1'
    and aceito_em = '2026-07-20T10:00:00Z' \gset
select case when :cnt_apos = 2 then 1 else 1/0 end as assert_log_intacto;
select case when :cnt_v1_pos = 1 then 1 else 1/0 end as assert_v1_ainda_intacto;
\echo 'OK: update e delete nao alteram nenhuma linha; as duas versoes seguem la, intactas'

reset role;

\echo '--- cenario 5: B nao le nem grava consentimento de A ---'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select count(*) as cnt_b_ve_a from public.user_lgpd_consents
  where user_id = '11111111-1111-1111-1111-111111111111' \gset
select case when :cnt_b_ve_a = 0 then 1 else 1/0 end as assert_b_nao_ve_a;

\set ON_ERROR_STOP off
insert into public.user_lgpd_consents (user_id, versao_termos) values
  ('11111111-1111-1111-1111-111111111111', 'v3');
\set ON_ERROR_STOP on
select case when :'ERROR' = 'true' and :'SQLSTATE' = '42501' then 1 else 1/0 end as assert_b_nao_grava_por_a;
\echo 'OK: consentimento de A invisivel e ingravavel para B'

reset role;
\echo '=== ALL LGPD CONSENT ASSERTIONS PASSED ==='
