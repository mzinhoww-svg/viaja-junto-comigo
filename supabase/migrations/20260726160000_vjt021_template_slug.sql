-- =============================================================
-- VJT-021 — slug da viagem exemplo
--
-- `/trip/exemplo` vira `/orlando`: URL curta, compartilhável e legível, que é
-- o formato de quem manda o link por WhatsApp.
--
-- O slug fica no BANCO e não na rota porque a próxima cidade é decisão de
-- produto, não de deploy: com isso, publicar um segundo exemplo é inserir uma
-- linha e adicionar um arquivo de rota de três linhas — não mexer no
-- componente, no hook nem nas policies.
-- =============================================================

alter table public.trips
  add column if not exists template_slug text;

-- Único entre os que existem: dois exemplos não podem disputar a mesma URL.
-- Parcial, então as trips normais (todas com `null`) ficam de fora do índice.
create unique index if not exists idx_trips_template_slug
  on public.trips(template_slug)
  where template_slug is not null;

update public.trips
   set template_slug = 'orlando'
 where id = '9e8a54ea-546b-4d0c-a843-da6e171055a8'
   and is_template;

-- Mesmo congelamento das colunas do VJT-020, pela mesma razão: sem isto, um
-- usuário qualquer grava `template_slug = 'orlando'` na própria trip e toma a
-- URL do exemplo — ou apenas ocupa o índice único e impede o operador de
-- publicar. Quem grava esta coluna é o operador, nunca o app.
create or replace function public.trip_template_slug(p_trip_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select template_slug from public.trips where id = p_trip_id;
$$;

alter policy trips_insert on public.trips
  with check (
    owner_id = auth.uid()
    and not is_template
    and cloned_from_template_id is null
    and template_slug is null
  );

alter policy trips_update on public.trips
  using (is_trip_member(id))
  with check (
    is_trip_member(id)
    and owner_id = public.trip_owner_id(id)
    and is_template = public.is_template_trip(id)
    and cloned_from_template_id is not distinct from public.trip_cloned_from_template_id(id)
    and template_slug is not distinct from public.trip_template_slug(id)
  );

-- A clonagem não leva o slug: o clone é viagem de gente, não exemplo público.
-- `clone_template_trip` já lista as colunas do insert uma a uma e não inclui
-- `template_slug`, então o clone nasce com `null` sem precisar de mudança —
-- este comentário existe para que a próxima pessoa a mexer na RPC saiba que
-- isso é garantia, não sorte.
