-- =============================================================
-- VJT-017b — Consentimento LGPD como log append-only + versão
-- (issue #65). Aplicar DEPOIS de
-- 20260725200000_vjt017_lgpd_nps_account_deletion.sql, que é quem cria
-- `user_lgpd_consents`.
--
-- Problema que esta migration resolve: o VJT-017 criou a tabela com
-- `user_id` como PRIMARY KEY — uma linha por usuário, sobrescrita
-- conceitualmente a cada novo aceite. Isso torna impossível responder
-- "quem aceitou QUAL texto e QUANDO", que é exatamente a pergunta que um
-- registro de consentimento existe para responder (LGPD Art. 8º, §1º: o
-- consentimento deve ser fornecido por escrito ou por outro meio que
-- demonstre a manifestação de vontade — e Art. 9º: mudança de finalidade
-- exige novo consentimento, sem apagar o anterior).
--
-- Depois desta migration a tabela é um LOG: uma linha por (usuário,
-- versão de termos) aceita, com o `aceito_em` daquele aceite. Subir
-- `LGPD_CONSENT_VERSION` no client passa a re-apresentar o gate sem
-- destruir o aceite anterior.
-- =============================================================

-- 1) PK própria em vez de `user_id`, para permitir mais de uma linha por
--    usuário. `gen_random_uuid()` já é usado no resto do schema (pgcrypto
--    habilitado desde o VJT-001).
alter table public.user_lgpd_consents
  drop constraint user_lgpd_consents_pkey;

alter table public.user_lgpd_consents
  add column id uuid not null default gen_random_uuid();

alter table public.user_lgpd_consents
  add constraint user_lgpd_consents_pkey primary key (id);

-- 2) O default 'v1' na coluna de versão era seguro quando havia uma linha
--    só por usuário; num log ele é uma armadilha — um insert que esqueça a
--    versão grava silenciosamente um aceite de texto errado. A versão passa
--    a ser sempre explícita (o client manda `LGPD_CONSENT_VERSION`).
alter table public.user_lgpd_consents
  alter column versao_termos drop default;

-- 3) Histórico não é lixeira: um usuário aceita CADA versão no máximo uma
--    vez. Isso também dá idempotência ao aceite (duplo clique / retry de
--    rede não vira segunda linha) — o client trata 23505 como sucesso.
alter table public.user_lgpd_consents
  add constraint user_lgpd_consents_user_versao_unique unique (user_id, versao_termos);

-- 4) O gate lê "todas as versões que este usuário já aceitou, mais recente
--    primeiro" a cada montagem de `/trip/*`.
create index idx_user_lgpd_consents_user_aceito
  on public.user_lgpd_consents (user_id, aceito_em desc);

-- 5) Append-only de verdade: as policies do VJT-017 (`lgpd_consent_select_own`
--    e `lgpd_consent_insert_own`) continuam válidas e continuam sendo as
--    ÚNICAS — sem policy de UPDATE nem de DELETE, com RLS habilitada,
--    nenhum client autenticado consegue reescrever ou apagar um aceite já
--    registrado. Isso é intencional e é o que dá valor probatório ao log;
--    não adicione policy de update/delete aqui sem revisar o motivo.
--    (A única exclusão possível segue sendo o cascade de
--    `auth.users on delete cascade`, que é o direito de exclusão do próprio
--    titular — Art. 18, já implementado no VJT-017.)
comment on table public.user_lgpd_consents is
  'Log append-only de consentimento LGPD: uma linha por (user_id, versao_termos) aceita. Sem policy de update/delete por design (VJT-017b).';
comment on column public.user_lgpd_consents.versao_termos is
  'Versão do texto aceito (LGPD_CONSENT_VERSION em src/lib/lgpd-consent.ts). O gate compara com a versão vigente e re-apresenta o aceite quando divergir.';
