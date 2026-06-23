-- =========================================================
-- FATIA 1 — Jornada "pagar primeiro" + checkout com Cartão 12x
-- Fonte: Claude Design "Correcao - Checkout do pacote (Lovable).md"
-- Nova ordem: proposta -> pagamento -> contrato -> documentos -> taxas -> agenda -> conclusao
-- Também corrige compute_journey_steps (chaves de produto inválidas: 'passaporte' -> 'pass', etc.)
-- =========================================================

-- 1) Colunas de cartão em requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payment_installments INTEGER,
  ADD COLUMN IF NOT EXISTS payment_card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS payment_attempts INTEGER NOT NULL DEFAULT 0;

-- 2) compute_journey_steps — reordenada (pagamento antes do contrato) + chaves de enum corrigidas
CREATE OR REPLACE FUNCTION public.compute_journey_steps(_request_id uuid)
RETURNS TABLE(idx integer, key text, label text, status journey_step_status_t)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.requests%ROWTYPE;
  has_vistos boolean := false;
  has_pass boolean := false;
  has_roteiro boolean := false;
  has_milhas boolean := false;
  docs_ok boolean := false; ds160_ok boolean := false;
  intent_ok boolean := false; taxes_ok boolean := false;
  active_set boolean := false;
  i int := 0;
  s public.journey_step_status_t;
  keys text[] := ARRAY[]::text[];
  labels text[] := ARRAY[]::text[];
  flags boolean[] := ARRAY[]::boolean[];
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF r.id IS NULL THEN RETURN; END IF;

  -- product_key em proposal_items é o enum product_key_t = (vistos, pass, rot, mil)
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'vistos') INTO has_vistos;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'pass')   INTO has_pass;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'rot')    INTO has_roteiro;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'mil')    INTO has_milhas;

  IF NOT (has_vistos OR has_pass OR has_roteiro OR has_milhas) THEN
    has_vistos := true;
  END IF;

  -- 1) Proposta (todos)
  keys   := array_append(keys, 'proposta');   labels := array_append(labels, 'Proposta');
  flags  := array_append(flags, r.proposal_status = 'accepted');

  -- 2) Pagamento da consultoria — PAGAR PRIMEIRO (todos)
  keys   := array_append(keys, 'pagamento');  labels := array_append(labels, 'Pagamento');
  flags  := array_append(flags, r.payment_status = 'paid');

  -- 3) Bloco Vistos — contrato vem DEPOIS do pagamento
  IF has_vistos THEN
    keys   := array_append(keys, 'contrato');  labels := array_append(labels, 'Contrato');
    flags  := array_append(flags, r.contract_signed = true);

    SELECT NOT EXISTS (
      SELECT 1 FROM public.documents d JOIN public.travelers t ON t.id = d.traveler_id
      WHERE t.request_id = _request_id AND d.kind <> 'ds160'
        AND d.status NOT IN ('received','approved')
    ) AND EXISTS (
      SELECT 1 FROM public.documents d JOIN public.travelers t ON t.id = d.traveler_id
      WHERE t.request_id = _request_id AND d.kind <> 'ds160'
    ) INTO docs_ok;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.travelers t LEFT JOIN public.ds160_submission ss ON ss.traveler_id = t.id
      WHERE t.request_id = _request_id AND (ss.status IS NULL OR ss.status <> 'validated')
    ) AND EXISTS (SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id) INTO ds160_ok;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.travelers t LEFT JOIN public.tax_payments tp ON tp.traveler_id = t.id
      WHERE t.request_id = _request_id AND (tp.status IS NULL OR tp.status = 'pending')
    ) AND EXISTS (SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id) INTO taxes_ok;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.travelers t
      CROSS JOIN (VALUES ('casv'::public.sched_service_t), ('entrevista'::public.sched_service_t)) AS req(service)
      WHERE t.request_id = _request_id
        AND NOT EXISTS (SELECT 1 FROM public.schedule_intents si
          WHERE si.traveler_id = t.id AND si.service = req.service AND si.status = 'confirmed')
    ) AND EXISTS (SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id) INTO intent_ok;

    keys := array_append(keys, 'documentos'); labels := array_append(labels, 'Documentos');
    flags := array_append(flags, docs_ok AND ds160_ok);
    keys := array_append(keys, 'taxas');      labels := array_append(labels, 'Taxas');
    flags := array_append(flags, taxes_ok);
    keys := array_append(keys, 'agenda');     labels := array_append(labels, 'Agendamentos');
    flags := array_append(flags, intent_ok);
    keys := array_append(keys, 'conclusao');  labels := array_append(labels, 'Conclusão');
    flags := array_append(flags, r.visa_outcome IS NOT NULL);
  END IF;

  -- Blocos de produto (briefing/entrega). Atenção: product_briefings.product_key usa nomes longos.
  IF has_pass THEN
    keys := array_append(keys, 'briefing_passaporte'); labels := array_append(labels, 'Briefing — Passaporte');
    flags := array_append(flags, EXISTS(SELECT 1 FROM public.product_briefings WHERE request_id=_request_id AND product_key='passaporte' AND status IN ('submitted','in_review','done')));
    keys := array_append(keys, 'entrega_passaporte'); labels := array_append(labels, 'Passaporte entregue');
    flags := array_append(flags, r.passport_status = 'entregue');
  END IF;
  IF has_roteiro THEN
    keys := array_append(keys, 'briefing_roteiro'); labels := array_append(labels, 'Briefing — Roteiro');
    flags := array_append(flags, EXISTS(SELECT 1 FROM public.product_briefings WHERE request_id=_request_id AND product_key='roteiro' AND status IN ('submitted','in_review','done')));
    keys := array_append(keys, 'entrega_roteiro'); labels := array_append(labels, 'Roteiro entregue');
    flags := array_append(flags, EXISTS(SELECT 1 FROM public.roteiros WHERE request_id=_request_id AND status='entregue'));
  END IF;
  IF has_milhas THEN
    keys := array_append(keys, 'briefing_milhas'); labels := array_append(labels, 'Briefing — Milhas');
    flags := array_append(flags, EXISTS(SELECT 1 FROM public.product_briefings WHERE request_id=_request_id AND product_key='milhas' AND status IN ('submitted','in_review','done')));
    keys := array_append(keys, 'entrega_milhas'); labels := array_append(labels, 'Plano de milhas entregue');
    flags := array_append(flags, EXISTS(SELECT 1 FROM public.milhas_consult WHERE request_id=_request_id AND status='ativo'));
  END IF;

  FOR i IN 1..array_length(keys,1) LOOP
    IF flags[i] THEN s := 'done';
    ELSIF NOT active_set THEN s := 'active'; active_set := true;
    ELSE s := 'locked';
    END IF;
    idx := i; key := keys[i]; label := labels[i]; status := s;
    RETURN NEXT;
  END LOOP;
END; $$;

-- 3) sign_contract — agora exige payment_status='paid' (pagar primeiro) + nome >= 4 chars
CREATE OR REPLACE FUNCTION public.sign_contract(_request_id UUID, _name TEXT, _body_html TEXT, _ip TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.requests%ROWTYPE;
  _contract_id UUID;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
  IF r.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'payment_required';
  END IF;
  IF r.contract_signed THEN
    RAISE EXCEPTION 'already signed';
  END IF;
  IF char_length(btrim(coalesce(_name,''))) < 4 THEN
    RAISE EXCEPTION 'name_too_short';
  END IF;

  INSERT INTO public.contracts(request_id, client, status, body_html, signed_name, signed_ip, signed_at)
    VALUES (_request_id, r.lead_name, 'signed', _body_html, btrim(_name), _ip, now())
  RETURNING id INTO _contract_id;

  UPDATE public.requests
     SET contract_signed = true,
         sign_name = btrim(_name),
         signed_at = now(),
         client_signature_ip = _ip
   WHERE id = _request_id;

  RETURN jsonb_build_object('contract_id', _contract_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.sign_contract(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 4) confirm_payment — registra o valor do pacote ao confirmar
CREATE OR REPLACE FUNCTION public.confirm_payment(_request_id UUID, _paid BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.requests
    WHERE id = _request_id AND agency_id = public.current_agency_id()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _paid THEN
    UPDATE public.requests
       SET payment_status = 'paid',
           payment_paid_at = now(),
           payment_confirmed_by = auth.uid(),
           payment_method = COALESCE(payment_method, 'pix'),
           payment_amount_cents = CASE WHEN payment_amount_cents > 0 THEN payment_amount_cents ELSE proposal_total_cents END
     WHERE id = _request_id;

    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id, 'payment_confirmed', 'Pagamento da consultoria confirmado',
            'Recebemos o pagamento do pacote. Agora é só assinar o contrato.', 'client');
  ELSE
    UPDATE public.requests
       SET payment_status = 'pending',
           payment_paid_at = NULL,
           payment_confirmed_by = NULL
     WHERE id = _request_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, BOOLEAN) TO authenticated;

-- 5) pay_with_card — checkout do pacote no cartão (simulação isolada do gateway)
--    Espelha o protótipo §8: 1ª tentativa 'declined' -> retry 'paid'; alternar p/ Pix fica no front.
CREATE OR REPLACE FUNCTION public.pay_with_card(_request_id uuid, _installments int, _card_last4 text, _simulate_outcome text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.requests%ROWTYPE;
  _outcome text;
  _attempts int;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.proposal_status <> 'accepted' THEN RAISE EXCEPTION 'proposal_not_accepted'; END IF;
  IF r.payment_status = 'paid' THEN
    RETURN jsonb_build_object('status','paid','already',true);
  END IF;
  IF COALESCE(_installments,1) < 1 OR COALESCE(_installments,1) > 12 THEN
    RAISE EXCEPTION 'invalid_installments';
  END IF;

  _attempts := COALESCE(r.payment_attempts,0) + 1;
  _outcome := COALESCE(NULLIF(_simulate_outcome,''),
                CASE WHEN _attempts = 1 THEN 'declined' ELSE 'paid' END);

  IF _outcome = 'paid' THEN
    UPDATE public.requests
       SET payment_status = 'paid',
           payment_method = 'card',
           payment_installments = _installments,
           payment_card_last4 = _card_last4,
           payment_attempts = _attempts,
           payment_amount_cents = proposal_total_cents,
           payment_paid_at = now()
     WHERE id = _request_id;

    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id, 'payment_confirmed', 'Pagamento da consultoria aprovado',
            'Pagamento no cartão aprovado. Agora é só assinar o contrato.', 'client');
  ELSE
    UPDATE public.requests
       SET payment_status = 'declined',
           payment_method = 'card',
           payment_installments = _installments,
           payment_card_last4 = _card_last4,
           payment_attempts = _attempts
     WHERE id = _request_id;
  END IF;

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (auth.uid(), 'pay_with_card', _request_id::text,
          jsonb_build_object('outcome', _outcome, 'installments', _installments,
                             'last4', _card_last4, 'attempt', _attempts));

  RETURN jsonb_build_object('status', _outcome, 'attempt', _attempts);
END; $$;

GRANT EXECUTE ON FUNCTION public.pay_with_card(uuid, int, text, text) TO authenticated;
