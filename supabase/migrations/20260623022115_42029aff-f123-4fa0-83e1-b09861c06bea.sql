
-- ============= ENUM resultado do visto =============
DO $$ BEGIN
  CREATE TYPE public.visa_outcome_t AS ENUM ('aprovado','recusado','admin_processing','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= ALTER requests =============
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS visa_outcome public.visa_outcome_t,
  ADD COLUMN IF NOT EXISTS visa_decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visa_validity_until DATE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_rating INTEGER,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS travel_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS passport_status TEXT NOT NULL DEFAULT 'coletando',
  ADD COLUMN IF NOT EXISTS passport_notes TEXT;

-- ============= ALTER agencies =============
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS emergency_contacts JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============= ALTER roteiros =============
ALTER TABLE public.roteiros
  ADD COLUMN IF NOT EXISTS share_url TEXT,
  ADD COLUMN IF NOT EXISTS release_notes TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- ============= ALTER milhas_consult =============
ALTER TABLE public.milhas_consult
  ADD COLUMN IF NOT EXISTS plano TEXT,
  ADD COLUMN IF NOT EXISTS alertas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'briefing',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- ============= ALTER notifications =============
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Policy adicional: cliente vê notificações destinadas a ele
DROP POLICY IF EXISTS notifications_client_read ON public.notifications;
CREATE POLICY notifications_client_read ON public.notifications FOR SELECT TO authenticated
  USING (audience = 'client' AND public.is_request_member(request_id));

-- ============= RPC: set_visa_outcome (admin) =============
CREATE OR REPLACE FUNCTION public.set_visa_outcome(
  _request_id UUID,
  _outcome public.visa_outcome_t,
  _validity_until DATE
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.requests
     SET visa_outcome = _outcome,
         visa_decision_at = CASE WHEN _outcome IS NULL THEN NULL ELSE now() END,
         visa_validity_until = CASE WHEN _outcome = 'aprovado' THEN _validity_until ELSE NULL END
   WHERE id = _request_id;

  -- notifica cliente
  IF _outcome IS NOT NULL THEN
    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id, 'visa_outcome',
      'Resultado do visto atualizado',
      CASE _outcome
        WHEN 'aprovado' THEN 'Boa notícia: seu visto foi aprovado.'
        WHEN 'recusado' THEN 'O consulado decidiu pela recusa. Veja os próximos passos no portal.'
        WHEN 'admin_processing' THEN 'Seu caso entrou em análise administrativa (administrative processing).'
        ELSE 'Seu caso foi marcado como cancelado.'
      END,
      'client');
  END IF;
END; $$;

-- ============= RPC: archive_request / reopen_case =============
CREATE OR REPLACE FUNCTION public.archive_request(_request_id UUID, _archive BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.requests SET archived_at = CASE WHEN _archive THEN now() ELSE NULL END WHERE id = _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reopen_case(_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.requests
     SET visa_outcome = NULL, visa_decision_at = NULL, visa_validity_until = NULL, archived_at = NULL
   WHERE id = _request_id;
END; $$;

-- ============= RPC: upsert_roteiro / publish_roteiro =============
CREATE OR REPLACE FUNCTION public.upsert_roteiro(_request_id UUID, payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID; _id UUID; _existing_version INT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  _id := NULLIF(payload->>'id','')::uuid;
  IF _id IS NULL THEN
    INSERT INTO public.roteiros(request_id, trip, status, nota, anexos, share_url, release_notes, version)
    VALUES (_request_id,
            payload->>'trip',
            COALESCE(payload->>'status','producao'),
            payload->>'nota',
            COALESCE(payload->'anexos','[]'::jsonb),
            NULLIF(payload->>'share_url',''),
            payload->>'release_notes',
            COALESCE((payload->>'version')::int, 1))
    RETURNING id INTO _id;
  ELSE
    SELECT version INTO _existing_version FROM public.roteiros WHERE id = _id AND request_id = _request_id;
    IF _existing_version IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
    UPDATE public.roteiros
       SET trip = COALESCE(payload->>'trip', trip),
           nota = COALESCE(payload->>'nota', nota),
           anexos = COALESCE(payload->'anexos', anexos),
           share_url = COALESCE(NULLIF(payload->>'share_url',''), share_url),
           release_notes = COALESCE(payload->>'release_notes', release_notes),
           version = COALESCE((payload->>'version')::int, version)
     WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('id', _id);
END; $$;

CREATE OR REPLACE FUNCTION public.publish_roteiro(_roteiro_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req UUID; _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT r.request_id, q.agency_id INTO _req, _agency
  FROM public.roteiros r JOIN public.requests q ON q.id = r.request_id
  WHERE r.id = _roteiro_id;
  IF _req IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.roteiros SET status = 'entregue', published_at = now() WHERE id = _roteiro_id;
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_req,'roteiro_published','Seu roteiro está disponível','Acesse o portal para conferir.','client');
END; $$;

-- ============= RPC: upsert_milhas / publish_milhas =============
CREATE OR REPLACE FUNCTION public.upsert_milhas(_request_id UUID, payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID; _id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO _id FROM public.milhas_consult WHERE request_id = _request_id LIMIT 1;
  IF _id IS NULL THEN
    INSERT INTO public.milhas_consult(request_id, plano, alertas, anexos, status)
    VALUES (_request_id,
            payload->>'plano',
            COALESCE(payload->'alertas','[]'::jsonb),
            COALESCE(payload->'anexos','[]'::jsonb),
            COALESCE(payload->>'status','briefing'))
    RETURNING id INTO _id;
  ELSE
    UPDATE public.milhas_consult
       SET plano = COALESCE(payload->>'plano', plano),
           alertas = COALESCE(payload->'alertas', alertas),
           anexos = COALESCE(payload->'anexos', anexos),
           status = COALESCE(payload->>'status', status)
     WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('id', _id);
END; $$;

CREATE OR REPLACE FUNCTION public.publish_milhas(_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.milhas_consult SET status = 'ativo', published_at = now() WHERE request_id = _request_id;
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id,'milhas_published','Seu plano de milhas está disponível','Acesse o portal para conferir.','client');
END; $$;

-- ============= RPC: set_passport_status / upsert_emergency_contacts =============
CREATE OR REPLACE FUNCTION public.set_passport_status(_request_id UUID, _status TEXT, _notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('coletando','em_emissao','pronto','entregue') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.requests SET passport_status = _status, passport_notes = NULLIF(btrim(_notes),'') WHERE id = _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_emergency_contacts(_contacts JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _agency := public.current_agency_id();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no agency'; END IF;
  UPDATE public.agencies SET emergency_contacts = COALESCE(_contacts,'{}'::jsonb) WHERE id = _agency;
END; $$;

-- ============= RPC cliente: save_travel_checklist / submit_feedback / mark_notification_read =============
CREATE OR REPLACE FUNCTION public.save_travel_checklist(_request_id UUID, _items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.requests SET travel_checklist = COALESCE(_items,'{}'::jsonb) WHERE id = _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_feedback(_request_id UUID, _rating INT, _feedback TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'invalid rating'; END IF;
  UPDATE public.requests SET client_rating = _rating, client_feedback = NULLIF(btrim(_feedback),'') WHERE id = _request_id;
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id,'feedback_received','Cliente enviou avaliação', _rating || ' estrelas','admin');
END; $$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(_notification_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req UUID; _aud TEXT;
BEGIN
  SELECT request_id, audience INTO _req, _aud FROM public.notifications WHERE id = _notification_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _aud = 'client' THEN
    IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSE
    IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  UPDATE public.notifications SET read_at = now() WHERE id = _notification_id;
END; $$;

-- ============= compute_journey_steps: conclusao=done quando visa_outcome IS NOT NULL =============
CREATE OR REPLACE FUNCTION public.compute_journey_steps(_request_id uuid)
 RETURNS TABLE(idx integer, key text, label text, status public.journey_step_status_t)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r public.requests%ROWTYPE;
  docs_ok BOOLEAN := false;
  ds160_ok BOOLEAN := false;
  intent_ok BOOLEAN := false;
  taxes_ok BOOLEAN := false;
  flags BOOLEAN[7];
  i INT;
  s public.journey_step_status_t;
  active_set BOOLEAN := false;
  keys TEXT[]   := ARRAY['proposta','contrato','pagamento','documentos','taxas','agenda','conclusao'];
  labels TEXT[] := ARRAY['Proposta','Contrato','Pagamento','Documentos','Taxas','Agendamentos','Conclusão'];
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF r.id IS NULL THEN RETURN; END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.documents d JOIN public.travelers t ON t.id = d.traveler_id
    WHERE t.request_id = _request_id AND d.kind <> 'ds160'
      AND d.status NOT IN ('received','approved')
  ) AND EXISTS (
    SELECT 1 FROM public.documents d JOIN public.travelers t ON t.id = d.traveler_id
    WHERE t.request_id = _request_id AND d.kind <> 'ds160'
  ) INTO docs_ok;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t LEFT JOIN public.ds160_submission s ON s.traveler_id = t.id
    WHERE t.request_id = _request_id AND (s.status IS NULL OR s.status <> 'validated')
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

  flags[1] := r.proposal_status = 'accepted';
  flags[2] := r.contract_signed = true;
  flags[3] := r.payment_status = 'paid';
  flags[4] := docs_ok AND ds160_ok;
  flags[5] := taxes_ok;
  flags[6] := intent_ok;
  flags[7] := r.visa_outcome IS NOT NULL;

  FOR i IN 1..7 LOOP
    IF flags[i] THEN s := 'done';
    ELSIF NOT active_set THEN s := 'active'; active_set := true;
    ELSE s := 'locked';
    END IF;
    idx := i; key := keys[i]; label := labels[i]; status := s;
    RETURN NEXT;
  END LOOP;
END; $$;

-- ============= Realtime publication =============
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.roteiros;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.milhas_consult;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
