
-- =========================================================
-- FASE 8 — Briefings & Chat
-- =========================================================

-- 1) product_briefings
CREATE TABLE IF NOT EXISTS public.product_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  product_key text NOT NULL CHECK (product_key IN ('passaporte','roteiro','milhas')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','in_review','done')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, product_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_briefings TO authenticated;
GRANT ALL ON public.product_briefings TO service_role;

ALTER TABLE public.product_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "briefings_member_read" ON public.product_briefings;
CREATE POLICY "briefings_member_read" ON public.product_briefings
  FOR SELECT TO authenticated
  USING (public.is_request_member(request_id));

CREATE OR REPLACE FUNCTION public.touch_product_briefings_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_product_briefings ON public.product_briefings;
CREATE TRIGGER trg_touch_product_briefings
  BEFORE UPDATE ON public.product_briefings
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_briefings_updated();

CREATE INDEX IF NOT EXISTS idx_product_briefings_request ON public.product_briefings(request_id);

-- 2) messages — extensões
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_request_created ON public.messages(request_id, created_at);

-- 3) RPCs — Briefings

CREATE OR REPLACE FUNCTION public.save_briefing(_request_id uuid, _product_key text, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _product_key NOT IN ('passaporte','roteiro','milhas') THEN RAISE EXCEPTION 'invalid product'; END IF;

  INSERT INTO public.product_briefings(request_id, product_key, payload, status)
  VALUES (_request_id, _product_key, COALESCE(_payload,'{}'::jsonb), 'draft')
  ON CONFLICT (request_id, product_key) DO UPDATE
    SET payload = COALESCE(EXCLUDED.payload, public.product_briefings.payload),
        status = CASE WHEN public.product_briefings.status IN ('submitted','in_review','done')
                      THEN public.product_briefings.status ELSE 'draft' END
  RETURNING id INTO _id;
  RETURN jsonb_build_object('id', _id);
END; $$;

CREATE OR REPLACE FUNCTION public.submit_briefing(_request_id uuid, _product_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.product_briefings
     SET status = 'submitted', submitted_at = now()
   WHERE request_id = _request_id AND product_key = _product_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'briefing not found'; END IF;

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'briefing_submitted',
          'Briefing enviado pelo cliente',
          'Produto: ' || _product_key, 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.mark_briefing_reviewed(_briefing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT b.request_id, r.agency_id INTO _req, _agency
  FROM public.product_briefings b JOIN public.requests r ON r.id = b.request_id
  WHERE b.id = _briefing_id;
  IF _req IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.product_briefings
     SET status = 'in_review', reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = _briefing_id;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_briefing(_request_id uuid, _product_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.product_briefings
     SET status = 'done', reviewed_at = COALESCE(reviewed_at, now())
   WHERE request_id = _request_id AND product_key = _product_key
     AND status <> 'done';
END; $$;

-- 4) Hooks de auto-complete nos publishers existentes

CREATE OR REPLACE FUNCTION public.publish_roteiro(_roteiro_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req UUID; _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT r.request_id, q.agency_id INTO _req, _agency
  FROM public.roteiros r JOIN public.requests q ON q.id = r.request_id
  WHERE r.id = _roteiro_id;
  IF _req IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.roteiros SET status = 'entregue', published_at = now() WHERE id = _roteiro_id;
  PERFORM public.complete_briefing(_req, 'roteiro');
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_req,'roteiro_published','Seu roteiro está disponível','Acesse o portal para conferir.','client');
END; $$;

CREATE OR REPLACE FUNCTION public.publish_milhas(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.milhas_consult SET status = 'ativo', published_at = now() WHERE request_id = _request_id;
  PERFORM public.complete_briefing(_request_id, 'milhas');
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id,'milhas_published','Seu plano de milhas está disponível','Acesse o portal para conferir.','client');
END; $$;

CREATE OR REPLACE FUNCTION public.set_passport_status(_request_id uuid, _status text, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('coletando','em_emissao','pronto','entregue') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.requests SET passport_status = _status, passport_notes = NULLIF(btrim(_notes),'') WHERE id = _request_id;
  IF _status = 'entregue' THEN
    PERFORM public.complete_briefing(_request_id, 'passaporte');
  END IF;
END; $$;

-- 5) RPCs — Chat

CREATE OR REPLACE FUNCTION public.send_message(_request_id uuid, _body text, _attachments jsonb, _internal boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _is_admin boolean; _is_member boolean;
BEGIN
  _is_admin := public.has_role(auth.uid(),'admin')
               AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = _request_id AND r.agency_id = public.current_agency_id());
  _is_member := public.is_request_member(_request_id);
  IF NOT (_is_admin OR _is_member) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(btrim(_body),'') = '' AND COALESCE(jsonb_array_length(_attachments),0) = 0 THEN
    RAISE EXCEPTION 'empty message';
  END IF;
  IF _internal AND NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.messages(request_id, sender_id, body, attachments, internal)
  VALUES (_request_id, auth.uid(), btrim(_body), COALESCE(_attachments,'[]'::jsonb), COALESCE(_internal,false))
  RETURNING id INTO _id;

  IF NOT COALESCE(_internal,false) THEN
    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id, 'new_message',
            CASE WHEN _is_admin THEN 'Nova mensagem da Viajaly' ELSE 'Nova mensagem do cliente' END,
            LEFT(COALESCE(_body,''), 140),
            CASE WHEN _is_admin THEN 'client' ELSE 'admin' END);
  END IF;

  RETURN jsonb_build_object('id', _id);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_admin boolean;
BEGIN
  _is_admin := public.has_role(auth.uid(),'admin')
               AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = _request_id AND r.agency_id = public.current_agency_id());
  IF NOT (_is_admin OR public.is_request_member(_request_id)) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _is_admin THEN
    UPDATE public.messages SET read_at = now()
     WHERE request_id = _request_id AND read_at IS NULL
       AND internal = false
       AND sender_id NOT IN (SELECT id FROM public.profiles WHERE agency_id = public.current_agency_id() AND role = 'admin');
  ELSE
    UPDATE public.messages SET read_at = now()
     WHERE request_id = _request_id AND read_at IS NULL
       AND internal = false
       AND sender_id IN (SELECT p.id FROM public.profiles p
                         JOIN public.requests r ON r.agency_id = p.agency_id
                         WHERE r.id = _request_id AND p.role = 'admin');
  END IF;
END; $$;

-- 6) Reescrita de compute_journey_steps — condicional ao produto

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

  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'vistos')      INTO has_vistos;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'passaporte')  INTO has_pass;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'roteiro')     INTO has_roteiro;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = _request_id AND product_key = 'milhas')      INTO has_milhas;

  IF NOT (has_vistos OR has_pass OR has_roteiro OR has_milhas) THEN
    has_vistos := true;
  END IF;

  keys   := array_append(keys, 'proposta');   labels := array_append(labels, 'Proposta');
  flags  := array_append(flags, r.proposal_status = 'accepted');

  IF has_vistos THEN
    keys   := array_append(keys, 'contrato');  labels := array_append(labels, 'Contrato');
    flags  := array_append(flags, r.contract_signed = true);
  END IF;

  keys   := array_append(keys, 'pagamento');  labels := array_append(labels, 'Pagamento');
  flags  := array_append(flags, r.payment_status = 'paid');

  IF has_vistos THEN
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

-- 7) Storage policies — bucket "documents"

DROP POLICY IF EXISTS "chat_attachments_member_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_member_write" ON storage.objects;
DROP POLICY IF EXISTS "briefing_attachments_member_read" ON storage.objects;
DROP POLICY IF EXISTS "briefing_attachments_member_write" ON storage.objects;

CREATE POLICY "chat_attachments_member_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'chat'
    AND public.is_request_member(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "chat_attachments_member_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'chat'
    AND public.is_request_member(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "briefing_attachments_member_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'briefing'
    AND public.is_request_member(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "briefing_attachments_member_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'briefing'
    AND public.is_request_member(((storage.foldername(name))[2])::uuid)
  );

-- 8) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_briefings;
