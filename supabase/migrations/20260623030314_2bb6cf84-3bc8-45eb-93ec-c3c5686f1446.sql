
-- ============ A) TAXAS — novo modelo de cobrança ============
DROP TABLE IF EXISTS public.tax_payments CASCADE;

DO $$ BEGIN
  CREATE TYPE public.tax_kind_t AS ENUM ('consular_mrv','passaporte_pf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.tax_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id UUID NOT NULL REFERENCES public.travelers(id) ON DELETE CASCADE,
  kind public.tax_kind_t NOT NULL,
  amount_usd_cents INTEGER,
  amount_brl_cents INTEGER NOT NULL DEFAULT 0,
  status public.tax_payment_status_t NOT NULL DEFAULT 'pending',
  pix_txid TEXT,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (traveler_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_payments TO authenticated;
GRANT ALL ON public.tax_payments TO service_role;

ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_payments_member" ON public.tax_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.travelers t
      WHERE t.id = tax_payments.traveler_id
        AND public.is_request_member(t.request_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.travelers t
      WHERE t.id = tax_payments.traveler_id
        AND public.is_request_member(t.request_id)
    )
  );

CREATE TRIGGER trg_tax_payments_updated
  BEFORE UPDATE ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_schedule_intents_updated();

ALTER TABLE public.tax_payments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tax_payments;

-- ============ create_traveler_defaults ============
CREATE OR REPLACE FUNCTION public.create_traveler_defaults()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _has_vistos boolean; _has_pass boolean;
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

  INSERT INTO public.schedule_intents (traveler_id, service, status) VALUES
    (NEW.id, 'casv', 'open'), (NEW.id, 'entrevista', 'open'), (NEW.id, 'pf', 'open');

  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = NEW.request_id AND product_key = 'vistos') INTO _has_vistos;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = NEW.request_id AND product_key = 'passaporte') INTO _has_pass;

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

-- ============ sync_taxes_for_item ============
CREATE OR REPLACE FUNCTION public.sync_taxes_for_item()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _req uuid; _pk public.product_key_t;
BEGIN
  _req := COALESCE(NEW.request_id, OLD.request_id);
  _pk  := COALESCE(NEW.product_key, OLD.product_key);
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF _pk = 'vistos' THEN
      INSERT INTO public.tax_payments(traveler_id, kind, amount_usd_cents, amount_brl_cents, status)
      SELECT t.id, 'consular_mrv', 18500, 0, 'pending'
      FROM public.travelers t WHERE t.request_id = _req
      ON CONFLICT (traveler_id, kind) DO NOTHING;
    ELSIF _pk = 'passaporte' THEN
      INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status)
      SELECT t.id, 'passaporte_pf', 25000, 'pending'
      FROM public.travelers t WHERE t.request_id = _req
      ON CONFLICT (traveler_id, kind) DO NOTHING;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;

DROP TRIGGER IF EXISTS trg_sync_taxes_for_item ON public.proposal_items;
CREATE TRIGGER trg_sync_taxes_for_item
  AFTER INSERT OR UPDATE ON public.proposal_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_taxes_for_item();

-- ============ RPC: lock_usd_rate ============
DROP FUNCTION IF EXISTS public.lock_usd_rate(uuid, boolean);
DROP FUNCTION IF EXISTS public.lock_usd_rate(uuid);
CREATE FUNCTION public.lock_usd_rate(_request_id uuid, _force boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _rate numeric; _as_of timestamptz; _source text; _existing numeric;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT usd_rate INTO _existing FROM public.requests WHERE id = _request_id;
  IF _existing IS NOT NULL AND NOT _force THEN
    SELECT usd_rate, usd_as_of, usd_source INTO _rate, _as_of, _source
    FROM public.requests WHERE id = _request_id;
    RETURN jsonb_build_object('rate', _rate, 'as_of', _as_of, 'source', _source, 'cached', true);
  END IF;
  _rate := 5.42; _as_of := now(); _source := 'simulated';
  UPDATE public.requests SET usd_rate = _rate, usd_as_of = _as_of, usd_source = _source WHERE id = _request_id;
  UPDATE public.tax_payments tp
     SET amount_brl_cents = ROUND(tp.amount_usd_cents * _rate)::int, updated_at = now()
   FROM public.travelers t
   WHERE tp.traveler_id = t.id AND t.request_id = _request_id
     AND tp.kind = 'consular_mrv' AND tp.status = 'pending';
  RETURN jsonb_build_object('rate', _rate, 'as_of', _as_of, 'source', _source, 'cached', false);
END; $function$;

-- ============ RPC: pay_taxes ============
DROP FUNCTION IF EXISTS public.pay_taxes(uuid, text);
DROP FUNCTION IF EXISTS public.pay_taxes(uuid);
CREATE FUNCTION public.pay_taxes(_request_id uuid, _method text DEFAULT 'pix')
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _total int; _rate numeric;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT usd_rate INTO _rate FROM public.requests WHERE id = _request_id;
  IF _rate IS NULL THEN RAISE EXCEPTION 'usd_rate_not_locked'; END IF;
  SELECT COALESCE(SUM(tp.amount_brl_cents), 0) INTO _total
  FROM public.tax_payments tp JOIN public.travelers t ON t.id = tp.traveler_id
  WHERE t.request_id = _request_id AND tp.status = 'pending';
  IF _total <= 0 THEN RAISE EXCEPTION 'no_pending_taxes'; END IF;
  RETURN jsonb_build_object('total_brl_cents', _total, 'rate', _rate, 'method', _method);
END; $function$;

-- ============ RPC: confirm_tax_payment ============
DROP FUNCTION IF EXISTS public.confirm_tax_payment(uuid, boolean);
CREATE FUNCTION public.confirm_tax_payment(_request_id uuid, _paid boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _paid THEN
    UPDATE public.tax_payments tp
       SET status = 'paid', paid_at = now(), reviewed_by = auth.uid(),
           payment_method = COALESCE(tp.payment_method, 'pix'), updated_at = now()
     FROM public.travelers t
     WHERE tp.traveler_id = t.id AND t.request_id = _request_id AND tp.status = 'pending';
  ELSE
    UPDATE public.tax_payments tp
       SET status = 'pending', paid_at = NULL, reviewed_by = NULL, updated_at = now()
     FROM public.travelers t
     WHERE tp.traveler_id = t.id AND t.request_id = _request_id AND tp.status = 'paid';
  END IF;
  PERFORM public.refresh_request_tax_status(_request_id);
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'tax_payment_updated',
          CASE WHEN _paid THEN 'Taxas confirmadas' ELSE 'Taxas revertidas para pendente' END,
          'Atualizado pela equipe.', 'client');
END; $function$;

-- ============ RPC: admin_set_tax_status (assinatura nova com _kind) ============
DROP FUNCTION IF EXISTS public.admin_set_tax_status(uuid, public.tax_payment_status_t, text);
DROP FUNCTION IF EXISTS public.admin_set_tax_status(uuid, public.tax_kind_t, public.tax_payment_status_t, text);
CREATE FUNCTION public.admin_set_tax_status(_traveler_id uuid, _kind public.tax_kind_t, _status public.tax_payment_status_t, _notes text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT t.request_id, r.agency_id INTO _req, _agency
  FROM public.travelers t JOIN public.requests r ON r.id = t.request_id
  WHERE t.id = _traveler_id;
  IF _req IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.tax_payments
     SET status = _status,
         notes = COALESCE(NULLIF(btrim(_notes),''), notes),
         reviewed_by = auth.uid(),
         paid_at = CASE WHEN _status IN ('paid','waived') THEN now() ELSE NULL END,
         updated_at = now()
   WHERE traveler_id = _traveler_id AND kind = _kind;
  PERFORM public.refresh_request_tax_status(_req);
END; $function$;

DROP FUNCTION IF EXISTS public.register_tax_payment(uuid, text, text);

-- ============ B) UPSELL ============
DROP FUNCTION IF EXISTS public.add_product_to_request(uuid, uuid, public.product_key_t);
CREATE FUNCTION public.add_product_to_request(_request_id uuid, _traveler_id uuid, _product_key public.product_key_t)
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
  FROM public.products_catalog WHERE product_key = _product_key::text AND active = true LIMIT 1;
  IF _price IS NULL THEN
    IF _product_key = 'passaporte' THEN _label := 'Assessoria de Passaporte'; _price := 39000;
    ELSE RAISE EXCEPTION 'product_not_in_catalog'; END IF;
  END IF;
  INSERT INTO public.proposal_items(request_id, product_key, kind, label, qty, unit_price_cents, discount_cents)
  VALUES (_request_id, _product_key, 'por_pessoa',
          _label || CASE WHEN _traveler_id IS NOT NULL THEN ' (upsell DS-160)' ELSE '' END,
          1, _price, 0);
  IF _product_key = 'passaporte' AND _traveler_id IS NOT NULL THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status)
    VALUES (_traveler_id, 'passaporte_pf', 25000, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'product_upsell', 'Produto adicionado pelo cliente',
          'Upsell de ' || _product_key::text || ' via DS-160.', 'admin');
  RETURN jsonb_build_object('ok', true, 'product_key', _product_key, 'price_cents', _price);
END; $function$;

-- ============ C) DS-160 — revisão humana ============
ALTER TABLE public.ds160_submission
  ADD COLUMN IF NOT EXISTS requires_human_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid;

DO $$ BEGIN
  ALTER TYPE public.ds160_status_t ADD VALUE IF NOT EXISTS 'pending_review';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.ds160_status_t ADD VALUE IF NOT EXISTS 'validated';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.submit_ds160(_traveler_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _req uuid; _pct int; _needs_review boolean;
BEGIN
  SELECT request_id INTO _req FROM public.travelers WHERE id = _traveler_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'traveler not found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT completion_pct, requires_human_review INTO _pct, _needs_review
  FROM public.ds160_submission WHERE traveler_id = _traveler_id;
  IF COALESCE(_pct,0) < 100 THEN RAISE EXCEPTION 'incomplete'; END IF;

  UPDATE public.ds160_submission
     SET status = CASE WHEN _needs_review THEN 'pending_review'::public.ds160_status_t ELSE 'received'::public.ds160_status_t END,
         submitted_at = now(), updated_at = now()
   WHERE traveler_id = _traveler_id;

  IF NOT _needs_review THEN
    UPDATE public.documents SET status = 'received', uploaded_at = now()
     WHERE traveler_id = _traveler_id AND kind = 'ds160';
  END IF;

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_req,
    CASE WHEN _needs_review THEN 'ds160_review_required' ELSE 'ds160_submitted' END,
    CASE WHEN _needs_review THEN 'DS-160 aguardando revisão humana' ELSE 'DS-160 enviado pelo cliente' END,
    CASE WHEN _needs_review THEN 'Cliente marcou perguntas de elegibilidade — revisar antes do envio oficial.' ELSE 'Pronto para o preenchimento oficial.' END,
    'admin');
END; $function$;

DROP FUNCTION IF EXISTS public.validate_ds160(uuid, boolean, text);
CREATE FUNCTION public.validate_ds160(_traveler_id uuid, _approve boolean, _notes text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _req uuid; _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT t.request_id, r.agency_id INTO _req, _agency
  FROM public.travelers t JOIN public.requests r ON r.id = t.request_id
  WHERE t.id = _traveler_id;
  IF _req IS NULL OR _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _approve THEN
    UPDATE public.ds160_submission
       SET status = 'validated', validated_at = now(), validated_by = auth.uid(),
           review_notes = COALESCE(NULLIF(btrim(_notes),''), review_notes), updated_at = now()
     WHERE traveler_id = _traveler_id;
    UPDATE public.documents SET status = 'received', uploaded_at = COALESCE(uploaded_at, now())
     WHERE traveler_id = _traveler_id AND kind = 'ds160';
    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_req, 'ds160_validated', 'DS-160 validado pela consultora',
            'Equipe vai preencher o formulário oficial.', 'client');
  ELSE
    UPDATE public.ds160_submission
       SET status = 'draft',
           review_notes = COALESCE(NULLIF(btrim(_notes),''), 'Necessário revisar respostas.'),
           updated_at = now()
     WHERE traveler_id = _traveler_id;
    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_req, 'ds160_rejected', 'DS-160 precisa de ajustes',
            COALESCE(NULLIF(btrim(_notes),''), 'Veja os comentários da consultora.'), 'client');
  END IF;
END; $function$;
