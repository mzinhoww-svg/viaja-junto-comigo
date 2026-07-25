-- =============================================================
-- VJT-014 — Assistente IA.
-- Duas funções security definer de suporte à Edge Function `ai-chat`:
--
-- 1. `increment_ai_usage()`: incremento atômico de `ai_usage.msgs_count` do
--    mês corrente para o usuário autenticado (auth.uid() interno, nunca um
--    parâmetro — evita que outro usuário incremente a cota alheia). Upsert
--    em vez de select-then-update para não perder incrementos concorrentes.
--    RLS `usage_own` (já existente desde o VJT-001) já permitiria o usuário
--    fazer esse upsert diretamente, mas centralizar num RPC evita duplicar a
--    lógica de "qual é o mes_ano corrente" entre client e Edge Function.
--
-- 2. `ai_daily_message_count()`: conta global (todas as trips/usuários) de
--    mensagens enviadas hoje, para o teto diário de proteção de custo
--    (Seção 7: "kill switch AI_ENABLED + teto diário global"). Precisa ser
--    security definer porque a policy `aim_all` de `ai_messages` restringe
--    leitura a membros da própria trip — aqui só devolvemos uma contagem
--    agregada, sem nenhum dado de mensagem individual.
-- =============================================================
create or replace function public.increment_ai_usage()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_mes_ano date := date_trunc('month', now())::date;
  v_count int;
begin
  insert into public.ai_usage (user_id, mes_ano, msgs_count)
  values (auth.uid(), v_mes_ano, 1)
  on conflict (user_id, mes_ano) do update set msgs_count = ai_usage.msgs_count + 1
  returning msgs_count into v_count;
  return v_count;
end;
$$;

create or replace function public.ai_daily_message_count()
returns bigint
language sql security definer set search_path = public stable as $$
  select count(*) from public.ai_messages
  where role = 'user' and created_at >= date_trunc('day', now());
$$;

-- Índice parcial (só mensagens de usuário) para a contagem diária acima não
-- fazer sequential scan em ai_messages conforme o volume cresce.
create index if not exists idx_ai_messages_created_at_user
  on public.ai_messages (created_at) where role = 'user';
