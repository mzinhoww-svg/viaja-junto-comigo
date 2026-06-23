-- =========================================================
-- FATIA 1 — Jornada "pagar primeiro" + checkout com Cartão 12x
-- =========================================================
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payment_installments INTEGER,
  ADD COLUMN IF NOT EXISTS payment_card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS payment_attempts INTEGER NOT NULL DEFAULT 0;

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

  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'vistos') INTO has_vistos;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'pass')   INTO has_pass;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'rot')    INTO has_roteiro;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'mil')    INTO has_milhas;

  IF NOT (has_vistos OR has_pass OR has_roteiro OR has_milhas) THEN
    has_vistos := true;
  END IF;

  keys   := array_append(keys, 'proposta');   labels := array_append(labels, 'Proposta');
  flags  := array_append(flags, r.proposal_status = 'accepted');

  keys   := array_append(keys, 'pagamento');  labels := array_append(labels, 'Pagamento');
  flags  := array_append(flags, r.payment_status = 'paid');

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

CREATE OR REPLACE FUNCTION public.sign_contract(_request_id UUID, _name TEXT, _body_html TEXT, _ip TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.requests%ROWTYPE;
  _contract_id UUID;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
  IF r.payment_status <> 'paid' THEN RAISE EXCEPTION 'payment_required'; END IF;
  IF r.contract_signed THEN RAISE EXCEPTION 'already signed'; END IF;
  IF char_length(btrim(coalesce(_name,''))) < 4 THEN RAISE EXCEPTION 'name_too_short'; END IF;

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

CREATE OR REPLACE FUNCTION public.confirm_payment(_request_id UUID, _paid BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.requests WHERE id = _request_id AND agency_id = public.current_agency_id()) THEN
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
       SET payment_status = 'pending', payment_paid_at = NULL, payment_confirmed_by = NULL
     WHERE id = _request_id;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_with_card(_request_id uuid, _installments int, _card_last4 text, _simulate_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.requests%ROWTYPE;
  _outcome text;
  _attempts int;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
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

-- =========================================================
-- FATIA 2 — Catálogo: combo 10% automático + planos de visto + desconto manual
-- =========================================================
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS combo_discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visto_plan public.visto_plan_t;

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

  _combo := CASE WHEN _cnt >= 2 THEN round(_sub * _combopct / 100.0)::int ELSE 0 END;

  UPDATE public.requests
     SET proposal_subtotal_cents = _sub,
         proposal_discount_cents = _itemdisc,
         combo_discount_cents    = _combo,
         proposal_total_cents    = GREATEST(_sub - _itemdisc - _combo - COALESCE(_manual,0), 0)
   WHERE id = _req;
END; $$;

CREATE OR REPLACE FUNCTION public.recompute_proposal_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_request_totals(COALESCE(NEW.request_id, OLD.request_id));
  RETURN NULL;
END; $$;

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

  PERFORM public.recompute_request_totals(_req_id);

  RETURN jsonb_build_object('request_id', _req_id, 'access_code', _code);
END; $$;
REVOKE ALL ON FUNCTION public.create_request_with_travelers(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_request_with_travelers(jsonb) TO authenticated;

DO $$
DECLARE _r uuid;
BEGIN
  FOR _r IN SELECT id FROM public.requests LOOP
    PERFORM public.recompute_request_totals(_r);
  END LOOP;
END $$;

-- =========================================================
-- FATIA 3 — DS-160: upsell de passaporte + documentos default
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_product_to_request(_request_id uuid, _traveler_id uuid, _product_key public.product_key_t)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _label text; _price int;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _traveler_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.travelers WHERE id = _traveler_id AND request_id = _request_id) THEN
      RAISE EXCEPTION 'traveler_not_in_request';
    END IF;
  END IF;
  SELECT name, ROUND(price * 100)::int INTO _label, _price
  FROM public.products_catalog WHERE key = _product_key AND active = true LIMIT 1;
  IF _price IS NULL THEN
    IF _product_key = 'pass' THEN _label := 'Assessoria de Passaporte'; _price := 39000;
    ELSE RAISE EXCEPTION 'product_not_in_catalog'; END IF;
  END IF;
  INSERT INTO public.proposal_items(request_id, product_key, kind, label, qty, unit_price_cents, discount_cents)
  VALUES (_request_id, _product_key, 'por_pessoa',
          _label || CASE WHEN _traveler_id IS NOT NULL THEN ' (upsell DS-160)' ELSE '' END,
          1, _price, 0);
  IF _product_key = 'pass' AND _traveler_id IS NOT NULL THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status)
    VALUES (_traveler_id, 'passaporte_pf', 25000, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'product_upsell', 'Produto adicionado pelo cliente',
          'Upsell de ' || _product_key::text || ' via DS-160.', 'admin');
  RETURN jsonb_build_object('ok', true, 'product_key', _product_key, 'price_cents', _price);
END; $function$;

CREATE OR REPLACE FUNCTION public.create_traveler_defaults()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _has_vistos boolean; _has_pass boolean;
BEGIN
  INSERT INTO public.documents (traveler_id, kind, name, status, required) VALUES
    (NEW.id, 'pass',  'Passaporte atual',                  'pending', true),
    (NEW.id, 'foto',  'Foto 5x5 digital',                  'pending', true),
    (NEW.id, 'outro', 'RG ou CNH',                         'pending', true),
    (NEW.id, 'outro', 'CPF (se não constar no RG)',        'pending', false),
    (NEW.id, 'renda', 'Comprovante de renda',              'pending', true),
    (NEW.id, 'vinc',  'Comprovante de vínculo',            'pending', true),
    (NEW.id, 'ds160', 'Confirmação DS-160 (geramos pra você)', 'locked', true);

  INSERT INTO public.ds160_submission (traveler_id, form, completion_pct, status)
    VALUES (NEW.id, '{}'::jsonb, 0, 'draft')
    ON CONFLICT (traveler_id) DO NOTHING;

  INSERT INTO public.schedule_intents (traveler_id, service, status) VALUES
    (NEW.id, 'casv', 'open'), (NEW.id, 'entrevista', 'open'), (NEW.id, 'pf', 'open');

  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = NEW.request_id AND product_key = 'vistos') INTO _has_vistos;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = NEW.request_id AND product_key = 'pass') INTO _has_pass;

  IF _has_vistos THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_usd_cents, amount_brl_cents, status)
    VALUES (NEW.id, 'consular_mrv', 18500, 0, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  IF _has_pass THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status)
    VALUES (NEW.id, 'passaporte_pf', 25000, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

-- =========================================================
-- FATIA 5c — CRUD admin do catálogo
-- =========================================================
DROP POLICY IF EXISTS products_catalog_admin_update ON public.products_catalog;
CREATE POLICY products_catalog_admin_update ON public.products_catalog
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS visto_plans_admin_update ON public.visto_plans;
CREATE POLICY visto_plans_admin_update ON public.visto_plans
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS products_catalog_admin_insert ON public.products_catalog;
CREATE POLICY products_catalog_admin_insert ON public.products_catalog
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS products_catalog_admin_delete ON public.products_catalog;
CREATE POLICY products_catalog_admin_delete ON public.products_catalog
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS visto_plans_admin_insert ON public.visto_plans;
CREATE POLICY visto_plans_admin_insert ON public.visto_plans
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS visto_plans_admin_delete ON public.visto_plans;
CREATE POLICY visto_plans_admin_delete ON public.visto_plans
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- Templates de contrato editáveis
-- =========================================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'default',
  title text NOT NULL DEFAULT 'Contrato padrão',
  body_html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_scope_key ON public.contract_templates(scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_templates_read ON public.contract_templates;
CREATE POLICY contract_templates_read ON public.contract_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS contract_templates_admin_write ON public.contract_templates;
CREATE POLICY contract_templates_admin_write ON public.contract_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.contract_templates(scope, title, body_html)
VALUES ('default', 'Contrato padrão (consultoria)',
'<h2>Contrato de Prestação de Serviços de Consultoria de Viagem</h2>
<p><b>CONTRATADA:</b> {{AGENCY}}<br/><b>CONTRATANTE:</b> {{CLIENT}}</p>
<h3>1. Objeto</h3>
<p>A CONTRATADA prestará serviços de consultoria especializada para obtenção de visto americano e gestão da jornada de viagem, incluindo orientação sobre preenchimento do formulário DS-160, agendamento de entrevista no consulado, análise documental e suporte ao CONTRATANTE.</p>
<h3>2. Viajantes</h3>
<ul>{{TRAVELERS}}</ul>
<h3>3. Itens contratados</h3>
<ul>{{ITEMS}}</ul>
<p><b>Valor total: {{TOTAL}}</b> — referente à consultoria. Taxas governamentais (MRV/visto, passaporte, Polícia Federal) são pagas à parte pelo CONTRATANTE.</p>
<h3>4. Prazo e obrigações</h3>
<p>O serviço inicia-se após a confirmação do pagamento. A CONTRATADA compromete-se a entregar o suporte com agilidade e a manter o CONTRATANTE informado de cada etapa pelo portal.</p>
<h3>5. Cancelamento</h3>
<p>O CONTRATANTE poderá solicitar cancelamento em até 7 dias da assinatura (CDC art. 49). Após esse prazo, valores correspondentes a serviços já executados (DS-160 preenchido, agendamento, taxa consular) não são reembolsáveis.</p>
<h3>6. LGPD</h3>
<p>O CONTRATANTE autoriza o tratamento dos seus dados pessoais e dos viajantes para a finalidade estrita deste contrato, em conformidade com a Lei nº 13.709/2018.</p>
<h3>7. Foro</h3>
<p>Fica eleito o foro do domicílio do CONTRATANTE para dirimir eventuais dúvidas.</p>
<p style="margin-top:24px"><b>{{DATE}}</b> — Aceite digital realizado pelo CONTRATANTE no portal Viajaly.</p>')
ON CONFLICT (scope) DO NOTHING;