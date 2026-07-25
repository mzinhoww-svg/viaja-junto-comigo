-- =============================================================
-- VJT-017 — LGPD (consentimento + exclusão de conta) + NPS da
-- viagem concluída (VIAJALY-TRIP.md Seção 7).
-- =============================================================

-- 1) Fecha o gap de ON DELETE CASCADE em referências a auth.users(id) que
--    faltava em 4 colunas desde o schema inicial (VJT-001). Sem isso,
--    supabase.auth.admin.deleteUser() falha com violação de FK sempre que o
--    usuário excluído não é o owner da trip (ex.: um membro convidado que
--    registrou uma economia ou uma conversa de IA em viagem de outra
--    pessoa) — a exclusão de conta precisa funcionar para qualquer membro,
--    não só para o owner.
alter table public.savings_entries
  drop constraint savings_entries_created_by_fkey,
  add constraint savings_entries_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete cascade;

alter table public.ai_conversations
  drop constraint ai_conversations_created_by_fkey,
  add constraint ai_conversations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete cascade;

alter table public.trip_invites
  drop constraint trip_invites_created_by_fkey,
  add constraint trip_invites_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete cascade;

alter table public.trip_invites
  drop constraint trip_invites_accepted_by_fkey,
  add constraint trip_invites_accepted_by_fkey
    foreign key (accepted_by) references auth.users(id) on delete cascade;

-- 2) NPS da viagem concluída (VJT-004 já deixava o CTA pronto; aqui entra a
--    coleta de fato). Uma resposta por usuário por trip — reenviar atualiza
--    a mesma linha (upsert no client) em vez de duplicar.
create table public.trip_nps_responses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nota int not null check (nota between 0 and 10),
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index idx_trip_nps_trip on public.trip_nps_responses(trip_id);
alter table public.trip_nps_responses enable row level security;
create policy trip_nps_select_own on public.trip_nps_responses
  for select using (user_id = auth.uid());
create policy trip_nps_insert_own on public.trip_nps_responses
  for insert with check (is_trip_member(trip_id) and user_id = auth.uid());
create policy trip_nps_update_own on public.trip_nps_responses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Consentimento LGPD — registrado uma vez por usuário. O produto Trip não
--    tem formulário de signup próprio (a conta nasce compartilhada com o
--    app de visto, via login OTP do portal); o primeiro acesso a `/trip/*`
--    é o ponto de contato equivalente a um "signup" para este produto, e é
--    onde o gate de consentimento (`LgpdConsentGate`) passa a bloquear até
--    o aceite.
create table public.user_lgpd_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  aceito_em timestamptz not null default now(),
  versao_termos text not null default 'v1'
);
alter table public.user_lgpd_consents enable row level security;
create policy lgpd_consent_select_own on public.user_lgpd_consents
  for select using (user_id = auth.uid());
create policy lgpd_consent_insert_own on public.user_lgpd_consents
  for insert with check (user_id = auth.uid());
