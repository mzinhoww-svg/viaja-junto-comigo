-- =========================================================
-- FATIA 5c (gap) — CRUD completo de catálogo no console (admin).
-- Adiciona INSERT e DELETE para admin em products_catalog e visto_plans.
-- UPDATE já foi concedido em 20260623180000. NÃO mexe em SELECT (leitura do wizard intacta).
-- =========================================================

-- products_catalog
DROP POLICY IF EXISTS products_catalog_admin_insert ON public.products_catalog;
CREATE POLICY products_catalog_admin_insert ON public.products_catalog
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS products_catalog_admin_delete ON public.products_catalog;
CREATE POLICY products_catalog_admin_delete ON public.products_catalog
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- visto_plans
DROP POLICY IF EXISTS visto_plans_admin_insert ON public.visto_plans;
CREATE POLICY visto_plans_admin_insert ON public.visto_plans
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS visto_plans_admin_delete ON public.visto_plans;
CREATE POLICY visto_plans_admin_delete ON public.visto_plans
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
