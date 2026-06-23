-- Fase 6: Agendamentos
ALTER TABLE public.schedule_intents
  ADD COLUMN IF NOT EXISTS wish_dates date[] NOT NULL DEFAULT ARRAY[]::date[],
  ADD COLUMN IF NOT EXISTS wish_period text,
  ADD COLUMN IF NOT EXISTS consulate text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_schedule_intents_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_touch_schedule_intents ON public.schedule_intents;
CREATE TRIGGER trg_touch_schedule_intents BEFORE UPDATE ON public.schedule_intents
  FOR EACH ROW EXECUTE FUNCTION public.touch_schedule_intents_updated();

-- Atualiza defaults do viajante para criar 3 intents
CREATE OR REPLACE FUNCTION public.create_traveler_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.documents (traveler_id, kind, name, status, required) VALUES
    (NEW.id, 'pass',  'Passaporte atual',                  'pending', true),
    (NEW.id, 'foto',  'Foto 5x5 digital',                  'pending', true),
    (NEW.id, 'renda', 'Comprovante de renda',              'pending', true),
    (NEW.id, 'vinc',  'Comprovante de vínculo',            'pending', true),
    (NEW.id, 'ds160', 'Confirmação DS-160 (geramos pra você)', 'locked', true);
  INSERT INTO public.ds160_submission (traveler_id, form, completion_pct, status)
    VALUES (NEW.id, '{}'::jsonb, 0, 'draft')
    ON CONFLICT (traveler_id) DO NOTHING;
  INSERT INTO public.tax_payments (traveler_id) VALUES (NEW.id)
    ON CONFLICT (traveler_id) DO NOTHING;
  INSERT INTO public.schedule_intents (traveler_id, service, status) VALUES
    (NEW.id, 'casv',       'open'),
    (NEW.id, 'entrevista', 'open'),
    (NEW.id, 'pf',         'open');
  RETURN NEW;
END; $$;

-- Backfill: viajantes existentes sem intents
INSERT INTO public.schedule_intents (traveler_id, service, status)
SELECT t.id, s.service::public.sched_service_t, 'open'::public.sched_status_t
FROM public.travelers t
CROSS JOIN (VALUES ('casv'), ('entrevista'), ('pf')) AS s(service)
WHERE NOT EXISTS (
  SELECT 1 FROM public.schedule_intents si
  WHERE si.traveler_id = t.id AND si.service::text = s.service
);

-- Backfill: schedule_window por agência sem registro
INSERT INTO public.schedule_window (agency_id, released_quinzenas, slots)
SELECT a.id, '[]'::jsonb, '{}'::jsonb FROM public.agencies a
WHERE NOT EXISTS (SELECT 1 FROM public.schedule_window sw WHERE sw.agency_id = a.id);

-- Permitir leitura pública (somente o que estiver liberado) das janelas pelo cliente da request
DROP POLICY IF EXISTS schedule_window_read_member ON public.schedule_window;
CREATE POLICY schedule_window_read_member ON public.schedule_window
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.agency_id = schedule_window.agency_id
        AND public.is_request_member(r.id)
    )
  );

-- RPC: cliente salva preferência
CREATE OR REPLACE FUNCTION public.save_intent_wish(
  _intent_id uuid,
  _wish_dates date[],
  _wish_period text,
  _consulate text,
  _notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid;
BEGIN
  SELECT t.request_id INTO _req
  FROM public.schedule_intents si
  JOIN public.travelers t ON t.id = si.traveler_id
  WHERE si.id = _intent_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'intent not found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.schedule_intents
     SET wish_dates  = COALESCE(_wish_dates, ARRAY[]::date[]),
         wish_period = NULLIF(btrim(_wish_period),''),
         consulate   = NULLIF(btrim(_consulate),''),
         notes       = NULLIF(btrim(_notes),''),
         status      = CASE WHEN status = 'confirmed' THEN status ELSE 'sent'::public.sched_status_t END
   WHERE id = _intent_id;
END; $$;

-- RPC: admin confirma data
CREATE OR REPLACE FUNCTION public.confirm_intent(
  _intent_id uuid,
  _confirmed_date date,
  _consulate text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT t.request_id, r.agency_id INTO _req, _agency
  FROM public.schedule_intents si
  JOIN public.travelers t ON t.id = si.traveler_id
  JOIN public.requests r ON r.id = t.request_id
  WHERE si.id = _intent_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'intent not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _confirmed_date IS NULL THEN RAISE EXCEPTION 'date required'; END IF;

  UPDATE public.schedule_intents
     SET status         = 'confirmed',
         confirmed_date = _confirmed_date,
         confirmed_by   = auth.uid(),
         consulate      = COALESCE(NULLIF(btrim(_consulate),''), consulate)
   WHERE id = _intent_id;
END; $$;

-- RPC: admin reabre
CREATE OR REPLACE FUNCTION public.reopen_intent(_intent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT r.agency_id INTO _agency
  FROM public.schedule_intents si
  JOIN public.travelers t ON t.id = si.traveler_id
  JOIN public.requests r ON r.id = t.request_id
  WHERE si.id = _intent_id;
  IF _agency IS NULL THEN RAISE EXCEPTION 'intent not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.schedule_intents
     SET status = 'open', confirmed_date = NULL, confirmed_by = NULL
   WHERE id = _intent_id;
END; $$;

-- RPC: admin atualiza janelas
CREATE OR REPLACE FUNCTION public.upsert_schedule_window(_slots jsonb, _released jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _agency := public.current_agency_id();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no agency'; END IF;

  INSERT INTO public.schedule_window (agency_id, slots, released_quinzenas)
  VALUES (_agency, COALESCE(_slots,'{}'::jsonb), COALESCE(_released,'[]'::jsonb))
  ON CONFLICT (agency_id) DO UPDATE
    SET slots = COALESCE(_slots, public.schedule_window.slots),
        released_quinzenas = COALESCE(_released, public.schedule_window.released_quinzenas);
END; $$;

-- Atualiza compute_journey_steps: PF é opcional
CREATE OR REPLACE FUNCTION public.compute_journey_steps(_request_id uuid)
 RETURNS TABLE(idx integer, key text, label text, status journey_step_status_t)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    SELECT 1 FROM public.documents d
    JOIN public.travelers t ON t.id = d.traveler_id
    WHERE t.request_id = _request_id AND d.kind <> 'ds160'
      AND d.status NOT IN ('received','approved')
  ) AND EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.travelers t ON t.id = d.traveler_id
    WHERE t.request_id = _request_id AND d.kind <> 'ds160'
  ) INTO docs_ok;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t
    LEFT JOIN public.ds160_submission s ON s.traveler_id = t.id
    WHERE t.request_id = _request_id
      AND (s.status IS NULL OR s.status <> 'validated')
  ) AND EXISTS (
    SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id
  ) INTO ds160_ok;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t
    LEFT JOIN public.tax_payments tp ON tp.traveler_id = t.id
    WHERE t.request_id = _request_id
      AND (tp.status IS NULL OR tp.status = 'pending')
  ) AND EXISTS (
    SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id
  ) INTO taxes_ok;

  -- Agenda: CASV e Entrevista confirmados para TODOS os viajantes (PF é opcional)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t
    CROSS JOIN (VALUES ('casv'::public.sched_service_t), ('entrevista'::public.sched_service_t)) AS req(service)
    WHERE t.request_id = _request_id
      AND NOT EXISTS (
        SELECT 1 FROM public.schedule_intents si
        WHERE si.traveler_id = t.id AND si.service = req.service AND si.status = 'confirmed'
      )
  ) AND EXISTS (
    SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id
  ) INTO intent_ok;

  flags[1] := r.proposal_status = 'accepted';
  flags[2] := r.contract_signed = true;
  flags[3] := r.payment_status = 'paid';
  flags[4] := docs_ok AND ds160_ok;
  flags[5] := taxes_ok;
  flags[6] := intent_ok;
  flags[7] := false;

  FOR i IN 1..7 LOOP
    IF flags[i] THEN s := 'done';
    ELSIF NOT active_set THEN s := 'active'; active_set := true;
    ELSE s := 'locked';
    END IF;
    idx := i; key := keys[i]; label := labels[i]; status := s;
    RETURN NEXT;
  END LOOP;
END; $function$;
