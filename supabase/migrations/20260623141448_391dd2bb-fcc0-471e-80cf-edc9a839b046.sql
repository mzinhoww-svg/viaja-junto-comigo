CREATE OR REPLACE FUNCTION public.mark_paid_from_stripe(
  _session_id text,
  _payment_intent_id text,
  _payment_method text,
  _amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Notificação para o cliente
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_req_id, 'payment_confirmed',
          'Pagamento da consultoria confirmado',
          'Pagamento confirmado via ' || COALESCE(_payment_method, 'cartão') || '. Agora é só assinar o contrato.',
          'client');

  -- Notificação para o consultor / equipe
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
END;
$$;