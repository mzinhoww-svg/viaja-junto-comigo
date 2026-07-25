-- =============================================================
-- VJT-011 — Entitlements + paywall único.
-- Habilita Realtime na tabela `entitlements` para que `useEntitlement()`
-- no client reflita uma ativação manual/admin (SQL Editor, origem
-- 'manual'/'pacote_visto' — bônus Pro+/Vip+) sem reload. RLS `ent_select_own`
-- (já existente desde o VJT-001) garante que cada usuário só recebe o
-- evento da própria linha.
--
-- Nenhuma policy de escrita é adicionada aqui: `entitlements` continua com
-- apenas `ent_select_own` (select). A ativação de bônus Pro+/Vip+ segue
-- sendo feita via SQL Editor/service role — nunca por mutação client-side.
-- Checkout Stripe (que também escreveria aqui) é escopo do VJT-012, ainda
-- não iniciado.
--
-- Guard idempotente: mesmo padrão já usado em
-- 20260623022115_42029aff-f123-4fa0-83e1-b09861c06bea.sql para as demais
-- tabelas de `supabase_realtime` — sem ele, reaplicar a migration (ex.:
-- reset de branch de dev do Supabase) falha com "already member of
-- publication".
-- =============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.entitlements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
