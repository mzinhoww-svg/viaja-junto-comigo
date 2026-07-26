-- =============================================================
-- VJT-022 — Orçamento da viagem exemplo com valores reais de fornecedor
--
-- Substitui INTEIRAMENTE os itens de orçamento da `Expedição Orlando em
-- Família` pelos valores reais cotados. Não acumula: os antigos são apagados
-- antes da inserção, então rodar duas vezes dá o mesmo resultado que rodar
-- uma.
--
-- A trip é localizada por `is_template` + `template_slug`, nunca por owner:
-- qual conta é dona do exemplo é detalhe operacional que pode mudar, enquanto
-- a flag é o que define o papel. O guard de `is_template` também garante que
-- este arquivo não tem como alcançar a viagem de um usuário real.
--
-- Câmbio de referência: R$ 5,40 (já gravado em `trips.cambio_manual`). Os
-- itens em dólar ficam em `valor_estimado_destino_cents` e são consolidados
-- pelo `consolidarValorBRL` do trip-math na leitura — nunca convertidos aqui,
-- para que mudar o câmbio recalcule a viagem inteira sem migration nova.
-- =============================================================

do $vjt022$
declare
  v_trip uuid;
  v_inseridos int;
begin
  select id into v_trip
    from public.trips
   where is_template and template_slug = 'orlando';

  if v_trip is null then
    -- Replay local do scripts/test-rls.sh roda contra um cluster vazio.
    raise notice 'VJT-022: nenhuma trip template com slug "orlando" — nada a fazer';
    return;
  end if;

  -- 1. Zera o orçamento antigo ------------------------------------------
  -- Some, entre outros: `Passagens GRU-MCO`, `Disney 4 dias` e `Universal 3
  -- dias` em USD, `Apart-hotel 11 noites` em USD, `Alimentação 12 dias` em
  -- USD, `Carro + gasolina + pedágios` e `Chip internacional e imprevistos`.
  delete from public.budget_items where trip_id = v_trip;

  -- 2. Itens reais -------------------------------------------------------
  -- A categoria é resolvida por nome; a asserção logo abaixo é o que impede
  -- que um nome de categoria fora do esperado faça uma linha sumir em
  -- silêncio no JOIN.
  insert into public.budget_items (
    trip_id, category_id, nome,
    valor_estimado_brl_cents, valor_estimado_destino_cents,
    valor_pago_brl_cents, valor_pago_destino_cents, nota
  )
  select v_trip, bc.id, d.item, d.est_brl, d.est_usd, d.pago_brl, 0, d.nota
    from (values
      -- ---- em reais -------------------------------------------------
      ('Passagens', 'Passagens GRU–Miami (4 pessoas)',
       1120000::bigint, null::bigint, 1120000::bigint,
       'Emitidas. Chegada por Miami; o trecho até Orlando é a van do grupo.'),

      ('Ingressos e Passeios', 'Disney — combo 4 parques (4 pessoas)',
       880000, null, 0, ''),

      ('Ingressos e Passeios', 'Universal — combo 3 parques com Epic (4 pessoas)',
       760000, null, 0, ''),

      ('Ingressos e Passeios', 'SeaWorld + Busch Gardens (4 pessoas)',
       304000, null, 0, ''),

      ('Hospedagem', 'Casa, 11 noites (valor por família)',
       500000, null, 150000, ''),

      ('Alimentação', 'Alimentação 12 dias (2 adultos e 2 crianças)',
       750000, null, 0,
       'Premissa: R$ 2.500 por adulto e metade disso (R$ 1.250) por criança — 2 × 2.500 + 2 × 1.250 = R$ 7.500. Muda se a composição da família mudar.'),

      ('Seguro', 'Seguro viagem (4 pessoas)',
       200000, null, 0, 'Obrigatório'),

      ('Documentos', 'Consultoria de visto Viajaly',
       120000, null, 120000, 'Pago'),

      -- ---- em dólar (consolidados pelo câmbio na leitura) -----------
      ('Transporte', 'Van do grupo, 12 dias (rateio de 3 famílias)',
       null, 59600, 0,
       'Premissa: rateio entre 3 famílias. US$ 596 é a cota de UMA família — o total do grupo é US$ 1.788. Muda se o grupo for maior ou menor.'),

      ('Documentos', 'Taxas consulares (4 vistos)',
       null, 74000, 0, 'Pagar antes da entrevista'),

      ('Compras', 'Compras e lembranças',
       null, 150000, 0, '')
    ) as d(categoria, item, est_brl, est_usd, pago_brl, nota)
    join public.budget_categories bc
      on bc.trip_id = v_trip and bc.nome = d.categoria;

  get diagnostics v_inseridos = row_count;
  if v_inseridos <> 11 then
    raise exception 'VJT-022: esperava 11 itens, inseriu % — nome de categoria divergente?', v_inseridos;
  end if;

  -- 3. A categoria que ficou vazia --------------------------------------
  -- `Outros` existia só para o chip internacional, que saiu. Categoria vazia
  -- numa página pública de demonstração é defeito visível, não neutralidade.
  delete from public.budget_categories
   where trip_id = v_trip
     and nome = 'Outros'
     and not exists (select 1 from public.budget_items bi where bi.category_id = budget_categories.id);

  -- 4. Poupança recalibrada ----------------------------------------------
  -- A meta caiu junto com o orçamento, então a poupança antiga deixaria a
  -- barra perto do fim. Alvo: progresso financeiro na faixa de 35–45%, que é
  -- onde a barra comunica "está acontecendo" sem parecer concluída.
  --
  -- meta      = R$ 61.654,40  (R$ 46.340,00 em BRL + US$ 2.836 × 5,40)
  -- pago      = R$ 13.900,00  (passagens + sinal da casa + consultoria)
  -- poupança  = R$ 11.000,00  (os 4 aportes abaixo)
  -- acumulado = R$ 24.900,00  →  40,4% da meta
  --
  -- Aportes crescentes de propósito: lê como uma família engrenando o hábito,
  -- que é a mecânica que o produto vende.
  update public.savings_entries set valor_brl_cents = 200000
   where trip_id = v_trip and mes_ano = '2026-04-01';
  update public.savings_entries set valor_brl_cents = 250000
   where trip_id = v_trip and mes_ano = '2026-05-01';
  update public.savings_entries set valor_brl_cents = 300000
   where trip_id = v_trip and mes_ano = '2026-06-01';
  update public.savings_entries set valor_brl_cents = 350000
   where trip_id = v_trip and mes_ano = '2026-07-01';
end
$vjt022$;
