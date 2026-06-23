
-- ============================================================
-- Fase 5: DS-160 + Taxas (por viajante)
-- ============================================================

-- 1) Enum status do pagamento de taxa por viajante
DO $$ BEGIN
  CREATE TYPE public.tax_payment_status_t AS ENUM ('pending','paid','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela tax_payments
CREATE TABLE IF NOT EXISTS public.tax_payments (
  traveler_id UUID PRIMARY KEY REFERENCES public.travelers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 18500,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.tax_payment_status_t NOT NULL DEFAULT 'pending',
  receipt_url TEXT,
  payment_method TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_payments TO authenticated;
GRANT ALL ON public.tax_payments TO service_role;

ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_payments_member ON public.tax_payments;
CREATE POLICY tax_payments_member ON public.tax_payments
  FOR ALL TO authenticated
  USING (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)))
  WITH CHECK (public.is_request_member((SELECT request_id FROM public.travelers WHERE id = traveler_id)));

-- 3) Backfill para viajantes existentes
INSERT INTO public.tax_payments (traveler_id)
SELECT id FROM public.travelers
ON CONFLICT (traveler_id) DO NOTHING;

-- 4) Atualizar trigger de defaults do viajante para criar tax_payments
CREATE OR REPLACE FUNCTION public.create_traveler_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  INSERT INTO public.tax_payments (traveler_id)
    VALUES (NEW.id)
    ON CONFLICT (traveler_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- 5) RPC: salvar rascunho do DS-160
CREATE OR REPLACE FUNCTION public.save_ds160_draft(_traveler_id uuid, _form jsonb, _completion_pct int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid;
BEGIN
  SELECT request_id INTO _req FROM public.travelers WHERE id = _traveler_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'traveler not found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.ds160_submission (traveler_id, form, completion_pct, status, updated_at)
    VALUES (_traveler_id, COALESCE(_form,'{}'::jsonb), GREATEST(0, LEAST(100, COALESCE(_completion_pct,0))), 'draft', now())
  ON CONFLICT (traveler_id) DO UPDATE
    SET form = EXCLUDED.form,
        completion_pct = EXCLUDED.completion_pct,
        updated_at = now(),
        status = CASE WHEN public.ds160_submission.status = 'validated' THEN 'validated' ELSE 'draft' END;
END; $$;

-- 6) RPC: enviar DS-160 para análise
CREATE OR REPLACE FUNCTION public.submit_ds160(_traveler_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid; _pct int;
BEGIN
  SELECT request_id INTO _req FROM public.travelers WHERE id = _traveler_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'traveler not found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT completion_pct INTO _pct FROM public.ds160_submission WHERE traveler_id = _traveler_id;
  IF COALESCE(_pct,0) < 100 THEN RAISE EXCEPTION 'incomplete'; END IF;

  UPDATE public.ds160_submission
     SET status = 'received', submitted_at = now(), updated_at = now()
   WHERE traveler_id = _traveler_id;

  UPDATE public.documents
     SET status = 'received', uploaded_at = now()
   WHERE traveler_id = _traveler_id AND kind = 'ds160';
END; $$;

-- 7) RPC: validar/rejeitar DS-160 (admin)
CREATE OR REPLACE FUNCTION public.validate_ds160(_traveler_id uuid, _approve boolean, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT t.request_id, r.agency_id INTO _req, _agency
  FROM public.travelers t JOIN public.requests r ON r.id = t.request_id
  WHERE t.id = _traveler_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'traveler not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _approve THEN
    UPDATE public.ds160_submission
       SET status = 'validated', updated_at = now(),
           package = COALESCE(package,'{}'::jsonb) - 'reject_reason'
     WHERE traveler_id = _traveler_id;
    UPDATE public.documents
       SET status = 'approved', reject_reason = NULL, reviewed_by = auth.uid()
     WHERE traveler_id = _traveler_id AND kind = 'ds160';
  ELSE
    UPDATE public.ds160_submission
       SET status = 'draft', updated_at = now(),
           package = COALESCE(package,'{}'::jsonb) || jsonb_build_object('reject_reason', COALESCE(NULLIF(btrim(_reason),''),'Revise os campos do DS-160'))
     WHERE traveler_id = _traveler_id;
    UPDATE public.documents
       SET status = 'rejected',
           reject_reason = COALESCE(NULLIF(btrim(_reason),''),'Revise os campos do DS-160'),
           reviewed_by = auth.uid()
     WHERE traveler_id = _traveler_id AND kind = 'ds160';
  END IF;
END; $$;

-- 8) RPC: cliente registra pagamento da taxa
CREATE OR REPLACE FUNCTION public.register_tax_payment(_traveler_id uuid, _receipt_url text, _method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid;
BEGIN
  SELECT request_id INTO _req FROM public.travelers WHERE id = _traveler_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'traveler not found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(btrim(_receipt_url),'') = '' THEN RAISE EXCEPTION 'receipt required'; END IF;

  INSERT INTO public.tax_payments (traveler_id, status, receipt_url, payment_method, paid_at, updated_at)
    VALUES (_traveler_id, 'paid', _receipt_url, NULLIF(btrim(_method),''), now(), now())
  ON CONFLICT (traveler_id) DO UPDATE
    SET status = 'paid',
        receipt_url = EXCLUDED.receipt_url,
        payment_method = EXCLUDED.payment_method,
        paid_at = now(),
        updated_at = now();

  -- Refresh derived tax_status na request
  PERFORM public.refresh_request_tax_status(_req);
END; $$;

-- 9) RPC: admin altera status da taxa
CREATE OR REPLACE FUNCTION public.admin_set_tax_status(_traveler_id uuid, _status public.tax_payment_status_t, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT t.request_id, r.agency_id INTO _req, _agency
  FROM public.travelers t JOIN public.requests r ON r.id = t.request_id
  WHERE t.id = _traveler_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'traveler not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.tax_payments (traveler_id, status, notes, reviewed_by, paid_at, updated_at)
    VALUES (_traveler_id, _status, NULLIF(btrim(_notes),''), auth.uid(),
            CASE WHEN _status IN ('paid','waived') THEN now() ELSE NULL END, now())
  ON CONFLICT (traveler_id) DO UPDATE
    SET status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        reviewed_by = auth.uid(),
        paid_at = CASE WHEN EXCLUDED.status IN ('paid','waived') THEN now() ELSE NULL END,
        updated_at = now();

  PERFORM public.refresh_request_tax_status(_req);
END; $$;

-- 10) Helper: deriva tax_status da request a partir dos tax_payments
CREATE OR REPLACE FUNCTION public.refresh_request_tax_status(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _all_paid boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t
    LEFT JOIN public.tax_payments tp ON tp.traveler_id = t.id
    WHERE t.request_id = _request_id
      AND (tp.status IS NULL OR tp.status = 'pending')
  ) AND EXISTS (
    SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id
  ) INTO _all_paid;

  UPDATE public.requests
     SET tax_status = CASE WHEN _all_paid THEN 'paid'::public.tax_status_t ELSE 'pending'::public.tax_status_t END
   WHERE id = _request_id;
END; $$;

-- 11) Atualizar compute_journey_steps para considerar DS-160 validado
CREATE OR REPLACE FUNCTION public.compute_journey_steps(_request_id uuid)
RETURNS TABLE(idx integer, key text, label text, status public.journey_step_status_t)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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

  -- docs não-ds160 ok
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

  -- ds160 de todos viajantes validado
  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t
    LEFT JOIN public.ds160_submission s ON s.traveler_id = t.id
    WHERE t.request_id = _request_id
      AND (s.status IS NULL OR s.status <> 'validated')
  ) AND EXISTS (
    SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id
  ) INTO ds160_ok;

  -- taxas de todos viajantes paid/waived
  SELECT NOT EXISTS (
    SELECT 1 FROM public.travelers t
    LEFT JOIN public.tax_payments tp ON tp.traveler_id = t.id
    WHERE t.request_id = _request_id
      AND (tp.status IS NULL OR tp.status = 'pending')
  ) AND EXISTS (
    SELECT 1 FROM public.travelers t WHERE t.request_id = _request_id
  ) INTO taxes_ok;

  SELECT EXISTS (
    SELECT 1 FROM public.schedule_intents si
    JOIN public.travelers t ON t.id = si.traveler_id
    WHERE t.request_id = _request_id AND si.status = 'confirmed'
  ) INTO intent_ok;

  flags[1] := r.proposal_status = 'accepted';
  flags[2] := r.contract_signed = true;
  flags[3] := r.payment_status = 'paid';
  flags[4] := docs_ok AND ds160_ok;
  flags[5] := taxes_ok;
  flags[6] := intent_ok;
  flags[7] := false;

  FOR i IN 1..7 LOOP
    IF flags[i] THEN
      s := 'done';
    ELSIF NOT active_set THEN
      s := 'active'; active_set := true;
    ELSE
      s := 'locked';
    END IF;
    idx := i; key := keys[i]; label := labels[i]; status := s;
    RETURN NEXT;
  END LOOP;
END; $$;

-- 12) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tax_payments;
