-- =============================================================
-- Viajaly Trip — Schema inicial (MVP)
-- Valores monetários em CENTAVOS (integer).
-- RLS por pertencimento à trip via is_trip_member().
-- =============================================================
create type trip_status as enum ('sonho', 'planejando', 'concluida');
create type member_role as enum ('owner', 'editor');
create type checklist_type as enum ('documentos', 'preparativos', 'mala', 'compras', 'custom');
create type slot_period as enum ('manha', 'tarde', 'noite');
create type plan_tier as enum ('free', 'premium');
create type entitlement_origin as enum ('stripe', 'pacote_visto', 'manual');
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Minha Viagem',
  destino_pais text not null,
  destino_cidade text,
  data_viagem date,
  num_pessoas int not null default 1 check (num_pessoas between 1 and 10),
  moeda_destino char(3),
  cambio_manual numeric(12,4),
  cambio_atualizado_em timestamptz,
  status trip_status not null default 'planejando',
  created_at timestamptz not null default now()
);
create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  nome text not null,
  cor text not null default '#0EA5E9',
  ordem int not null default 0,
  is_default boolean not null default false
);
create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id) on delete cascade,
  nome text not null,
  valor_estimado_brl_cents bigint check (valor_estimado_brl_cents >= 0),
  valor_estimado_destino_cents bigint check (valor_estimado_destino_cents >= 0),
  valor_pago_brl_cents bigint not null default 0 check (valor_pago_brl_cents >= 0),
  valor_pago_destino_cents bigint not null default 0 check (valor_pago_destino_cents >= 0),
  nota text,
  created_at timestamptz not null default now(),
  check (valor_estimado_brl_cents is not null or valor_estimado_destino_cents is not null)
);
create table public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  mes_ano date not null,
  valor_brl_cents bigint not null check (valor_brl_cents > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (trip_id, mes_ano, created_by)
);
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  tipo checklist_type not null,
  nome text not null,
  ordem int not null default 0
);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  titulo text not null,
  done boolean not null default false,
  nota text,
  prazo_dias_antes int,
  marco int,
  ordem int not null default 0
);
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  tipo checklist_type not null,
  titulo text not null,
  marco int,
  prazo_dias_antes int,
  tier plan_tier not null default 'free',
  regiao text,
  clima text,
  min_duracao int,
  com_crianca boolean,
  destino_pack text,
  ordem int not null default 0
);
create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  dia_numero int not null check (dia_numero >= 1),
  data date,
  ordem int not null default 0,
  unique (trip_id, dia_numero)
);
create table public.itinerary_slots (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days(id) on delete cascade,
  periodo slot_period not null,
  onde_ir text,
  onde_comer text,
  observacoes text,
  unique (day_id, periodo)
);
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  mes_ano date not null,
  msgs_count int not null default 0,
  primary key (user_id, mes_ano)
);
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plano plan_tier not null default 'free',
  origem entitlement_origin,
  stripe_payment_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.paises_visto (
  pais_iso char(2) primary key,
  pais_nome text not null,
  exige_visto_br boolean not null,
  tipo_visto text,
  link_consultoria text
);
create index idx_trip_members_user on public.trip_members(user_id);
create index idx_budget_items_trip on public.budget_items(trip_id);
create index idx_budget_items_category on public.budget_items(category_id);
create index idx_savings_trip on public.savings_entries(trip_id);
create index idx_checklists_trip on public.checklists(trip_id);
create index idx_checklist_items_list on public.checklist_items(checklist_id);
create index idx_itinerary_days_trip on public.itinerary_days(trip_id);
create index idx_itinerary_slots_day on public.itinerary_slots(day_id);
create index idx_ai_conversations_trip on public.ai_conversations(trip_id);
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = auth.uid());
$$;
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = auth.uid() and role = 'owner');
$$;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.savings_entries enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_slots enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.entitlements enable row level security;
alter table public.paises_visto enable row level security;
create policy trips_select on public.trips for select using (is_trip_member(id));
create policy trips_insert on public.trips for insert with check (owner_id = auth.uid());
create policy trips_update on public.trips for update using (is_trip_member(id));
create policy trips_delete on public.trips for delete using (is_trip_owner(id));
create policy members_select on public.trip_members for select using (is_trip_member(trip_id));
create policy members_insert_self_owner on public.trip_members for insert with check (
  (user_id = auth.uid() and role = 'owner'
    and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  or (user_id = auth.uid() and role = 'editor'
    and exists (select 1 from public.trip_invites i
                where i.trip_id = trip_members.trip_id and i.accepted_by = auth.uid() and i.expires_at > now()))
);
create policy members_delete on public.trip_members for delete using (is_trip_owner(trip_id) or user_id = auth.uid());
create policy invites_select on public.trip_invites for select using (is_trip_member(trip_id));
create policy invites_insert on public.trip_invites for insert with check (is_trip_owner(trip_id) and created_by = auth.uid());
create policy invites_delete on public.trip_invites for delete using (is_trip_owner(trip_id));
create or replace function public.accept_trip_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_invite public.trip_invites;
begin
  select * into v_invite from public.trip_invites where token = p_token and expires_at > now() and accepted_by is null;
  if not found then raise exception 'invite_invalid'; end if;
  update public.trip_invites set accepted_by = auth.uid() where id = v_invite.id;
  insert into public.trip_members (trip_id, user_id, role) values (v_invite.trip_id, auth.uid(), 'editor') on conflict do nothing;
  return v_invite.trip_id;
end;
$$;
create policy bc_all on public.budget_categories for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy bi_all on public.budget_items for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy se_all on public.savings_entries for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy cl_all on public.checklists for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy cli_all on public.checklist_items for all
  using (is_trip_member((select trip_id from public.checklists c where c.id = checklist_id)))
  with check (is_trip_member((select trip_id from public.checklists c where c.id = checklist_id)));
create policy itd_all on public.itinerary_days for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy its_all on public.itinerary_slots for all
  using (is_trip_member((select trip_id from public.itinerary_days d where d.id = day_id)))
  with check (is_trip_member((select trip_id from public.itinerary_days d where d.id = day_id)));
create policy aic_all on public.ai_conversations for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy aim_all on public.ai_messages for all
  using (is_trip_member((select trip_id from public.ai_conversations c where c.id = conversation_id)))
  with check (is_trip_member((select trip_id from public.ai_conversations c where c.id = conversation_id)));
create policy usage_own on public.ai_usage for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ent_select_own on public.entitlements for select using (user_id = auth.uid());
create policy templates_read on public.checklist_templates for select using (true);
create policy paises_read on public.paises_visto for select using (true);
insert into public.paises_visto (pais_iso, pais_nome, exige_visto_br, tipo_visto) values
  ('US', 'Estados Unidos', true,  'B1/B2'),
  ('CA', 'Canadá',         true,  'Visto/eTA'),
  ('AU', 'Austrália',      true,  'Visitor'),
  ('CN', 'China',          true,  'L'),
  ('IN', 'Índia',          true,  'e-Visa'),
  ('JP', 'Japão',          false, null),
  ('GB', 'Reino Unido',    false, null),
  ('PT', 'Portugal',       false, null),
  ('FR', 'França',         false, null),
  ('IT', 'Itália',         false, null),
  ('ES', 'Espanha',        false, null),
  ('AR', 'Argentina',      false, null),
  ('CL', 'Chile',          false, null),
  ('MX', 'México',         false, null);
insert into public.checklist_templates (tipo, titulo, tier, marco, ordem) values
  ('documentos', 'Passaporte válido (mínimo 6 meses após o retorno)', 'free', 90, 1),
  ('documentos', 'Passagens aéreas confirmadas', 'free', 60, 2),
  ('documentos', 'Seguro viagem contratado', 'free', 30, 3),
  ('documentos', 'Comprovante de hospedagem impresso/salvo', 'free', 15, 4),
  ('documentos', 'Cópias digitais dos documentos na nuvem', 'free', 7, 5),
  ('preparativos', 'Avisar o banco sobre a viagem', 'free', 15, 1),
  ('preparativos', 'Contratar chip internacional ou eSIM', 'free', 15, 2),
  ('preparativos', 'Verificar necessidade de vacinas', 'free', 60, 3),
  ('preparativos', 'Fazer câmbio / cartão internacional', 'free', 30, 4),
  ('mala', 'Roupas para o clima do destino', 'free', null, 1),
  ('mala', 'Adaptador de tomada universal', 'free', null, 2),
  ('mala', 'Medicamentos de uso contínuo + receitas', 'free', null, 3),
  ('mala', 'Carregadores e power bank', 'free', null, 4),
  ('compras', 'Mala/bagagem adequada às regras da cia aérea', 'free', null, 1),
  ('compras', 'Itens de higiene em tamanho de viagem', 'free', null, 2);
