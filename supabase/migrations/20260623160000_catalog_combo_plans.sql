-- =========================================================
-- FATIA 2 — Catálogo: combo 10% automático + planos de visto + desconto manual de ordem
-- Fonte: Build Spec §2/§6 (combo = items.length>=2 ? round(subtotal*comboPct/100) : 0) e §12.2/§12.6
-- =========================================================

-- 1) Colunas novas em requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS combo_discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visto_plan public.visto_plan_t;

-- 2) Função única de cálculo dos totais (combo automático + desconto manual de ordem)
CREATE OR REPLACE FUNCTION public.recompute_request_totals(_req uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub int; _itemdisc int; _cnt int; _combopct int; _manual int; _combo int;
BEGIN
  SELECT COALESCE(SUM(qty * unit_price_cents),0), COALESCE(SUM(discount_cents),0), COUNT(*)
    INTO _sub, _itemdisc, _cnt
    FROM public.proposal_items WHERE request_id = _req;

  SELECT COALESCE(combo_pct,10), COALESCE(manual_discount_cents,0)
    INTO _combopct, _manual
    FROM public.requests WHERE id = _req;

  -- combo automático: 10% (combo_pct) quando há 2+ itens na proposta
  _combo := CASE WHEN _cnt >= 2 THEN round(_sub * _combopct / 100.0)::int ELSE 0 END;

  UPDATE public.requests
     SET proposal_subtotal_cents = _sub,
         proposal_discount_cents = _itemdisc,
         combo_discount_cents    = _combo,
         proposal_total_cents    = GREATEST(_sub - _itemdisc - _combo - COALESCE(_manual,0), 0)
   WHERE id = _req;
END; $$;

-- 3) Trigger de proposal_items passa a delegar para a função única
CREATE OR REPLACE FUNCTION public.recompute_proposal_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_request_totals(COALESCE(NEW.request_id, OLD.request_id));
  RETURN NULL;
END; $$;

-- 4) Ajustes de proposta pelo admin (combo % + desconto manual de ordem) com recálculo
CREATE OR REPLACE FUNCTION public.set_proposal_adjustments(_request_id uuid, _combo_pct int, _manual_discount_cents int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
          AND EXISTS (SELECT 1 FROM public.requests WHERE id = _request_id AND agency_id = public.current_agency_id())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.requests
     SET combo_pct = COALESCE(_combo_pct, combo_pct),
         manual_discount_cents = GREATEST(COALESCE(_manual_discount_cents, manual_discount_cents), 0)
   WHERE id = _request_id;
  PERFORM public.recompute_request_totals(_request_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.set_proposal_adjustments(uuid, int, int) TO authenticated;

-- 5) create_request_with_travelers — aceita visto_plan, manual_discount_cents e combo_pct
CREATE OR REPLACE FUNCTION public.create_request_with_travelers(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency UUID; _req_id UUID; _group_id UUID; _code TEXT; _try INTEGER := 0;
  _trav JSONB; _item JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _agency := public.current_agency_id();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no agency'; END IF;

  LOOP
    _code := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.requests WHERE agency_id = _agency AND access_code = _code) OR _try > 50;
    _try := _try + 1;
  END LOOP;

  IF (payload->>'is_group')::boolean IS TRUE THEN
    INSERT INTO public.request_group(name) VALUES (COALESCE(payload->>'group_name','Grupo'))
    RETURNING id INTO _group_id;
  END IF;

  INSERT INTO public.requests(
    agency_id, lead_name, lead_email, lead_phone, whatsapp_e164,
    access_code, proposal_status, created_by,
    combo_pct, manual_discount_cents, visto_plan
  ) VALUES (
    _agency,
    payload->>'lead_name',
    lower(payload->>'lead_email'),
    payload->>'lead_phone',
    payload->>'whatsapp_e164',
    _code,
    'draft',
    auth.uid(),
    COALESCE((payload->>'combo_pct')::int, 10),
    GREATEST(COALESCE((payload->>'manual_discount_cents')::int, 0), 0),
    NULLIF(payload->>'visto_plan','')::public.visto_plan_t
  ) RETURNING id INTO _req_id;

  FOR _trav IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'travelers','[]'::jsonb))
  LOOP
    INSERT INTO public.travelers(request_id, name, relation)
    VALUES (_req_id, _trav->>'name', COALESCE(_trav->>'relation','titular'));
  END LOOP;

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'items','[]'::jsonb))
  LOOP
    INSERT INTO public.proposal_items(
      request_id, product_key, kind, label, qty, unit_price_cents, discount_cents, sort
    ) VALUES (
      _req_id,
      NULLIF(_item->>'product_key','')::public.product_key_t,
      COALESCE(_item->>'kind','extra'),
      _item->>'label',
      COALESCE((_item->>'qty')::int, 1),
      COALESCE((_item->>'unit_price_cents')::int, 0),
      COALESCE((_item->>'discount_cents')::int, 0),
      COALESCE((_item->>'sort')::int, 0)
    );
  END LOOP;

  -- garante o cálculo (combo + manual) mesmo se não houver itens disparando o trigger
  PERFORM public.recompute_request_totals(_req_id);

  RETURN jsonb_build_object('request_id', _req_id, 'access_code', _code);
END; $$;
REVOKE ALL ON FUNCTION public.create_request_with_travelers(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_request_with_travelers(jsonb) TO authenticated;

-- 6) Backfill: recalcula totais das requisições existentes (aplica combo retroativo)
DO $$
DECLARE _r uuid;
BEGIN
  FOR _r IN SELECT id FROM public.requests LOOP
    PERFORM public.recompute_request_totals(_r);
  END LOOP;
END $$;
