-- =============================================================
-- VJT-020 — Viagem exemplo pública + clonagem no cadastro
--
-- Abre para leitura pública UMA viagem marcada como template, e dá a RPC
-- que a clona para a conta de quem acabou de se cadastrar.
--
-- Regra que atravessa o arquivo inteiro: **nenhuma policy de escrita nova**.
-- Tudo abaixo é `for select`. Escrita continua exclusiva de membro, pelas
-- policies `*_all` do schema inicial (VIAJALY-TRIP.md, Seção 4).
-- =============================================================

-- 1. Colunas -------------------------------------------------------------

alter table public.trips
  add column if not exists is_template boolean not null default false;

-- Guarda a origem do clone. Serve a dois propósitos, nesta ordem de
-- importância: (a) é a chave da idempotência do `clone_template_trip`;
-- (b) deixa a porta aberta para, no futuro, tratar dias 6+ de uma trip
-- clonada de forma diferente (decisão 1 do VJT-020) sem migration nova.
alter table public.trips
  add column if not exists cloned_from_template_id uuid
    references public.trips(id) on delete set null;

-- Índice parcial: só a(s) trip(s) template entram, então ele fica minúsculo
-- e serve o `is_template_trip()` abaixo, que roda em toda leitura pública.
create index if not exists idx_trips_is_template
  on public.trips(is_template) where is_template;

-- A idempotência do clone vive AQUI, não só no plpgsql: duas chamadas
-- concorrentes da RPC passam pelo mesmo `select ... limit 1` sem se ver, e é
-- este unique que impede a segunda de gravar a duplicata.
create unique index if not exists idx_trips_clone_once
  on public.trips(owner_id, cloned_from_template_id)
  where cloned_from_template_id is not null;

-- 2. A viagem exemplo ----------------------------------------------------

-- `Expedição Orlando em Família` (conta demo@viajaly.app): 12 dias / 36 slots,
-- 4 listas / 114 itens, 11 itens de orçamento. Afeta 0 linhas no replay local
-- do scripts/test-rls.sh, que roda contra um cluster vazio — de propósito.
update public.trips
   set is_template = true
 where id = '9e8a54ea-546b-4d0c-a843-da6e171055a8';

-- 3. Helper de pertencimento ao template ---------------------------------

-- Mesmo padrão de `is_trip_member()`: security definer + stable, para que a
-- policy da tabela filha resolva a trip sem depender da RLS de `trips` dentro
-- da própria expressão de policy.
create or replace function public.is_template_trip(p_trip_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.trips where id = p_trip_id and is_template);
$$;

grant execute on function public.is_template_trip(uuid) to anon, authenticated;

-- 4. Leitura pública (SELECT e nada além) --------------------------------

-- Policies permissivas somam-se por OR às existentes: quem já enxergava por
-- `is_trip_member()` continua enxergando exatamente o mesmo conjunto, e
-- ninguém ganha uma linha a mais que não seja de trip template.
drop policy if exists trips_select_template on public.trips;
create policy trips_select_template on public.trips
  for select to anon, authenticated using (is_template);

drop policy if exists bc_select_template on public.budget_categories;
create policy bc_select_template on public.budget_categories
  for select to anon, authenticated using (is_template_trip(trip_id));

drop policy if exists bi_select_template on public.budget_items;
create policy bi_select_template on public.budget_items
  for select to anon, authenticated using (is_template_trip(trip_id));

drop policy if exists cl_select_template on public.checklists;
create policy cl_select_template on public.checklists
  for select to anon, authenticated using (is_template_trip(trip_id));

drop policy if exists cli_select_template on public.checklist_items;
create policy cli_select_template on public.checklist_items
  for select to anon, authenticated
  using (is_template_trip((select trip_id from public.checklists c where c.id = checklist_id)));

drop policy if exists itd_select_template on public.itinerary_days;
create policy itd_select_template on public.itinerary_days
  for select to anon, authenticated using (is_template_trip(trip_id));

drop policy if exists its_select_template on public.itinerary_slots;
create policy its_select_template on public.itinerary_slots
  for select to anon, authenticated
  using (is_template_trip((select trip_id from public.itinerary_days d where d.id = day_id)));

-- Grant de tabela é ortogonal à RLS: sem ele o `anon` toma 42501 antes de
-- qualquer policy ser avaliada. Só SELECT — o `anon` não recebe insert,
-- update ou delete em nenhuma destas tabelas.
grant select on public.trips to anon;
grant select on public.budget_categories to anon;
grant select on public.budget_items to anon;
grant select on public.checklists to anon;
grant select on public.checklist_items to anon;
grant select on public.itinerary_days to anon;
grant select on public.itinerary_slots to anon;

-- 4b. Congelar as duas colunas novas contra escrita de usuário -----------

-- Mesma lição do VJT-013, aplicada à coluna que este arquivo acabou de tornar
-- load-bearing: `trips_insert` só checava `owner_id = auth.uid()` e
-- `trips_update` só checava pertencimento, então, sem o que vem abaixo,
-- QUALQUER usuário poderia rodar `insert into trips (..., is_template) values
-- (..., true)` — ou marcar uma trip da qual é apenas editor — e publicar para
-- a internet inteira dados de uma viagem que não é dele. A escalação é criada
-- por esta migration, então é fechada por esta migration.
--
-- Isso não é "policy de escrita nova": as duas policies já existiam e
-- continuam permitindo exatamente o que permitiam. O que muda é que as duas
-- colunas do VJT-020 saem do alcance da escrita de usuário — quem grava
-- `is_template` é o operador (SQL do painel) e quem grava
-- `cloned_from_template_id` é a RPC security definer.
create or replace function public.trip_cloned_from_template_id(p_trip_id uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select cloned_from_template_id from public.trips where id = p_trip_id;
$$;

alter policy trips_insert on public.trips
  with check (
    owner_id = auth.uid()
    and not is_template
    and cloned_from_template_id is null
  );

-- `is_template = is_template_trip(id)` é o congelamento: o helper lê o valor
-- gravado por fora da RLS, então a linha só passa se o novo valor for igual
-- ao atual. As duas primeiras condições são as do VJT-013, preservadas.
alter policy trips_update on public.trips
  using (is_trip_member(id))
  with check (
    is_trip_member(id)
    and owner_id = public.trip_owner_id(id)
    and is_template = public.is_template_trip(id)
    and cloned_from_template_id is not distinct from public.trip_cloned_from_template_id(id)
  );

-- `savings_entries` fica DE FORA, e isso é decisão, não esquecimento: é a
-- única tabela do conjunto que identifica pessoa (`created_by` de um usuário
-- real) em vez de descrever plano de viagem. O progresso financeiro do
-- exemplo sai da função agregada abaixo.

-- 5. Progresso financeiro do exemplo, sem autor --------------------------

-- Devolve UM bigint: soma em centavos, sem autor, sem mês, sem linhas. É o
-- suficiente para a barra de progresso do exemplo e não expõe identidade.
-- O filtro `t.is_template` é o que impede a função de virar um oráculo para
-- somar as economias de qualquer trip do banco.
create or replace function public.template_trip_savings_total(p_trip_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select coalesce(sum(se.valor_brl_cents), 0)::bigint
    from public.savings_entries se
    join public.trips t on t.id = se.trip_id
   where se.trip_id = p_trip_id
     and t.is_template;
$$;

grant execute on function public.template_trip_savings_total(uuid) to anon, authenticated;

-- 6. Clonagem ------------------------------------------------------------

-- Clona trip + categorias + itens de orçamento + checklists + itens + roteiro
-- (dias e slots) para auth.uid(), como owner, com is_template = false.
--
-- Duas escolhas de conteúdo, decididas pelo dono do produto no VJT-020:
--   * os 12 dias vêm inteiros (degustação completa; o limite free de 5 dias
--     nunca bloqueou visualização, só criação de dia);
--   * vem o PLANO, não o progresso: `done` volta a false e `valor_pago_*` a
--     zero. Os itens marcados e os valores pagos do template são jornada de
--     outra pessoa — herdá-los faria o dashboard nascer com número falso.
--     `savings_entries` não são clonadas pelo mesmo motivo.
--
-- O limite de 1 viagem do plano free NÃO é checado aqui: a fonte única dessa
-- regra é `canCreateAnotherTrip` em src/lib/entitlements.ts, aplicada no CTA
-- junto do paywall `segunda_viagem`. Reimplementá-la em SQL criaria duas
-- regras de plano que divergem no primeiro dia em que uma delas mudar.
create or replace function public.clone_template_trip(p_trip_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_template public.trips;
  v_new_id uuid;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_template from public.trips where id = p_trip_id and is_template;
  if not found then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;

  -- Idempotência: já clonou este template, recebe a mesma trip de volta.
  select id into v_new_id
    from public.trips
   where owner_id = v_user and cloned_from_template_id = p_trip_id
   order by created_at
   limit 1;
  if v_new_id is not null then
    return v_new_id;
  end if;

  insert into public.trips (
    owner_id, nome, destino_pais, destino_cidade, data_viagem, num_pessoas,
    num_criancas, moeda_destino, cambio_manual, cambio_atualizado_em, status,
    is_template, cloned_from_template_id
  ) values (
    v_user, v_template.nome, v_template.destino_pais, v_template.destino_cidade,
    v_template.data_viagem, v_template.num_pessoas, v_template.num_criancas,
    v_template.moeda_destino, v_template.cambio_manual, v_template.cambio_atualizado_em,
    v_template.status, false, p_trip_id
  )
  returning id into v_new_id;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_new_id, v_user, 'owner');

  -- Categorias + itens numa statement só. As duas CTEs geram os ids novos
  -- antes de inserir, então o item já sabe a categoria de destino sem
  -- precisar de tabela de mapeamento; a checagem de FK roda no fim da
  -- statement, quando as categorias já existem.
  with src as (
    select id as old_id, gen_random_uuid() as new_id, nome, cor, ordem, is_default
      from public.budget_categories
     where trip_id = p_trip_id
  ), ins_cat as (
    insert into public.budget_categories (id, trip_id, nome, cor, ordem, is_default)
    select new_id, v_new_id, nome, cor, ordem, is_default from src
    returning id
  )
  insert into public.budget_items (
    trip_id, category_id, nome, valor_estimado_brl_cents, valor_estimado_destino_cents,
    valor_pago_brl_cents, valor_pago_destino_cents, nota
  )
  select v_new_id, src.new_id, bi.nome, bi.valor_estimado_brl_cents,
         bi.valor_estimado_destino_cents, 0, 0, bi.nota
    from public.budget_items bi
    join src on src.old_id = bi.category_id
   where bi.trip_id = p_trip_id;

  with src as (
    select id as old_id, gen_random_uuid() as new_id, tipo, nome, ordem
      from public.checklists
     where trip_id = p_trip_id
  ), ins_cl as (
    insert into public.checklists (id, trip_id, tipo, nome, ordem)
    select new_id, v_new_id, tipo, nome, ordem from src
    returning id
  )
  insert into public.checklist_items (checklist_id, titulo, done, nota, prazo_dias_antes, marco, ordem)
  select src.new_id, ci.titulo, false, ci.nota, ci.prazo_dias_antes, ci.marco, ci.ordem
    from public.checklist_items ci
    join src on src.old_id = ci.checklist_id;

  with src as (
    select id as old_id, gen_random_uuid() as new_id, dia_numero, data, ordem
      from public.itinerary_days
     where trip_id = p_trip_id
  ), ins_day as (
    insert into public.itinerary_days (id, trip_id, dia_numero, data, ordem)
    select new_id, v_new_id, dia_numero, data, ordem from src
    returning id
  )
  insert into public.itinerary_slots (day_id, periodo, onde_ir, onde_comer, observacoes)
  select src.new_id, s.periodo, s.onde_ir, s.onde_comer, s.observacoes
    from public.itinerary_slots s
    join src on src.old_id = s.day_id;

  return v_new_id;
exception
  -- Corrida entre duas chamadas simultâneas: a que perder o unique parcial
  -- devolve a trip que a outra acabou de criar, em vez de estourar um erro
  -- que o usuário leria como "não deu certo" numa clonagem que deu.
  when unique_violation then
    select id into v_new_id
      from public.trips
     where owner_id = v_user and cloned_from_template_id = p_trip_id
     order by created_at
     limit 1;
    if v_new_id is null then raise; end if;
    return v_new_id;
end;
$$;

revoke all on function public.clone_template_trip(uuid) from public;
grant execute on function public.clone_template_trip(uuid) to authenticated;
