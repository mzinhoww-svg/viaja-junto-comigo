-- =========================================================
-- FATIA 5c — Permite que admins editem o catálogo (produtos e planos de visto).
-- Adiciona apenas políticas de UPDATE para admin. Não habilita/desabilita RLS
-- (para não arriscar quebrar a leitura pública do catálogo usada no wizard).
-- Se a RLS estiver desativada na tabela, estas políticas ficam inertes (sem efeito).
-- =========================================================

DROP POLICY IF EXISTS products_catalog_admin_update ON public.products_catalog;
CREATE POLICY products_catalog_admin_update ON public.products_catalog
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS visto_plans_admin_update ON public.visto_plans;
CREATE POLICY visto_plans_admin_update ON public.visto_plans
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
