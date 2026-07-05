
-- 1) proposal_items: origin + billed_at
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS billed_at timestamptz;

CREATE INDEX IF NOT EXISTS proposal_items_unbilled_idx
  ON public.proposal_items(request_id) WHERE billed_at IS NULL;

-- 2) add_product_to_request: aceita origem e aplica preço promocional p/ renovação
DROP FUNCTION IF EXISTS public.add_product_to_request(uuid, uuid, public.product_key_t);
DROP FUNCTION IF EXISTS public.add_product_to_request(uuid, uuid, public.product_key_t, text);
CREATE FUNCTION public.add_product_to_request(
  _request_id uuid,
  _traveler_id uuid,
  _product_key public.product_key_t,
  _origin text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _label text; _price int; _tax_brl int := 25000; _promo boolean := false;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _traveler_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.travelers WHERE id = _traveler_id AND request_id = _request_id) THEN
      RAISE EXCEPTION 'traveler_not_in_request';
    END IF;
  END IF;

  SELECT name, ROUND(price * 100)::int INTO _label, _price
    FROM public.products_catalog WHERE product_key = _product_key::text AND active = true LIMIT 1;
  IF _price IS NULL THEN
    IF _product_key = 'pass' THEN _label := 'Assessoria de Passaporte'; _price := 39000;
    ELSE RAISE EXCEPTION 'product_not_in_catalog'; END IF;
  END IF;

  _promo := (_origin = 'upsell_renovacao' AND _product_key = 'pass');
  IF _promo THEN
    _label := 'Renovação de Passaporte (preço especial)';
    _price := 25900;
    _tax_brl := 25900;
  END IF;

  INSERT INTO public.proposal_items(
    request_id, product_key, kind, label, qty, unit_price_cents, discount_cents, origin
  )
  VALUES (
    _request_id, _product_key, 'por_pessoa',
    _label || CASE WHEN _traveler_id IS NOT NULL THEN ' (upsell DS-160)' ELSE '' END,
    1, _price, 0, _origin
  );

  -- A trigger sync_taxes_for_item já cria tax_payments(passaporte_pf, 25000).
  -- Para o promocional, sobrescrevemos para 25900 quando ainda está pendente.
  IF _product_key = 'pass' AND _traveler_id IS NOT NULL THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status, notes)
    VALUES (
      _traveler_id, 'passaporte_pf', _tax_brl, 'pending',
      CASE WHEN _promo THEN 'Renovação promocional' END
    )
    ON CONFLICT (traveler_id, kind) DO UPDATE
      SET amount_brl_cents = EXCLUDED.amount_brl_cents,
          notes = COALESCE(EXCLUDED.notes, public.tax_payments.notes),
          updated_at = now()
      WHERE public.tax_payments.status = 'pending';
  END IF;

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'product_upsell', 'Produto adicionado pelo cliente',
          'Upsell de ' || _product_key::text ||
          CASE WHEN _origin IS NOT NULL THEN ' (' || _origin || ')' ELSE '' END || '.', 'admin');

  RETURN jsonb_build_object('ok', true, 'product_key', _product_key, 'price_cents', _price, 'origin', _origin);
END; $$;
GRANT EXECUTE ON FUNCTION public.add_product_to_request(uuid, uuid, public.product_key_t, text) TO authenticated;

-- 3) Atualiza o RPC do webhook do pacote para marcar billed_at dos itens não-upsell
CREATE OR REPLACE FUNCTION public.mark_paid_from_stripe(
  _session_id text,
  _payment_intent_id text,
  _payment_method text,
  _amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _req_id uuid; _existing text; _lead_name text;
BEGIN
  SELECT id, payment_status, lead_name INTO _req_id, _existing, _lead_name
    FROM public.requests WHERE stripe_session_id = _session_id;

  IF _req_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found');
  END IF;
  IF _existing = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'request_id', _req_id);
  END IF;

  UPDATE public.requests
     SET payment_status = 'paid',
         payment_method = COALESCE(_payment_method, payment_method, 'card'),
         payment_amount_cents = COALESCE(_amount_cents, payment_amount_cents, proposal_total_cents),
         payment_paid_at = now(),
         stripe_payment_intent_id = COALESCE(_payment_intent_id, stripe_payment_intent_id)
   WHERE id = _req_id;

  -- Itens cobrados por este pagamento de pacote (exclui upsells de renovação,
  -- que vão pelo checkout de taxas).
  UPDATE public.proposal_items
     SET billed_at = now()
   WHERE request_id = _req_id
     AND billed_at IS NULL
     AND COALESCE(origin,'') <> 'upsell_renovacao';

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_req_id, 'payment_confirmed',
          'Pagamento da consultoria confirmado',
          'Pagamento confirmado via ' || COALESCE(_payment_method, 'cartão') ||
          '. Agora é só assinar o contrato.', 'client');
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_req_id, 'payment_confirmed',
          'Novo pagamento recebido — ' || COALESCE(_lead_name, 'cliente'),
          'Pagamento de R$ ' || to_char(COALESCE(_amount_cents,0)/100.0, 'FM999G999D00') ||
          ' confirmado via ' || COALESCE(_payment_method, 'cartão') || '. Avançar para contrato.',
          'consultant');

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (NULL, 'stripe_webhook_paid', _req_id::text,
          jsonb_build_object('session_id', _session_id, 'method', _payment_method, 'amount_cents', _amount_cents));

  RETURN jsonb_build_object('ok', true, 'request_id', _req_id, 'lead_name', _lead_name);
END; $$;

-- 4) Novo RPC chamado pelo webhook quando o checkout de TAXAS é confirmado
CREATE OR REPLACE FUNCTION public.mark_taxes_paid_from_stripe(
  _request_id uuid,
  _session_id text,
  _payment_intent_id text,
  _payment_method text,
  _amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _tax_rows int; _upsell_rows int; _lead_name text;
BEGIN
  IF _request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_request_id');
  END IF;

  SELECT lead_name INTO _lead_name FROM public.requests WHERE id = _request_id;

  UPDATE public.tax_payments tp
     SET status = 'paid',
         paid_at = COALESCE(tp.paid_at, now()),
         payment_method = COALESCE(tp.payment_method, _payment_method, 'stripe'),
         updated_at = now()
    FROM public.travelers t
   WHERE tp.traveler_id = t.id
     AND t.request_id = _request_id
     AND tp.status = 'pending';
  GET DIAGNOSTICS _tax_rows = ROW_COUNT;

  UPDATE public.proposal_items
     SET billed_at = now()
   WHERE request_id = _request_id
     AND billed_at IS NULL
     AND origin = 'upsell_renovacao';
  GET DIAGNOSTICS _upsell_rows = ROW_COUNT;

  PERFORM public.refresh_request_tax_status(_request_id);

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'tax_payment_updated', 'Taxas confirmadas',
          'Recebemos o pagamento das taxas. Vamos avançar para o agendamento.', 'client');
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'tax_payment_updated',
          'Taxas pagas — ' || COALESCE(_lead_name, 'cliente'),
          'R$ ' || to_char(COALESCE(_amount_cents,0)/100.0,'FM999G999D00') ||
          ' confirmado via ' || COALESCE(_payment_method,'Stripe') || '.', 'consultant');

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (NULL, 'stripe_taxes_paid', _request_id::text,
          jsonb_build_object('session_id', _session_id, 'pi', _payment_intent_id,
                             'method', _payment_method, 'amount_cents', _amount_cents,
                             'taxes_rows', _tax_rows, 'upsell_items', _upsell_rows));

  RETURN jsonb_build_object('ok', true, 'taxes_rows', _tax_rows, 'upsell_rows', _upsell_rows);
END; $$;
REVOKE ALL ON FUNCTION public.mark_taxes_paid_from_stripe(uuid, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_taxes_paid_from_stripe(uuid, text, text, text, integer) TO service_role;
