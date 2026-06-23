
-- =========================================================
-- FASE 9 — Slice 1
-- =========================================================

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#FF5A5F',
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS public_email text,
  ADD COLUMN IF NOT EXISTS public_whatsapp text,
  ADD COLUMN IF NOT EXISTS visa_disclaimer text;

UPDATE public.agencies
   SET visa_disclaimer = E'A Viajaly presta consultoria de viagem, não jurídica e não garante a aprovação de vistos.\n\nA decisão final é sempre do consulado.'
 WHERE visa_disclaimer IS NULL OR btrim(visa_disclaimer) = '';

ALTER TABLE public.agencies
  ALTER COLUMN visa_disclaimer SET NOT NULL,
  ALTER COLUMN visa_disclaimer SET DEFAULT E'A Viajaly presta consultoria de viagem, não jurídica e não garante a aprovação de vistos.\n\nA decisão final é sempre do consulado.';

CREATE OR REPLACE FUNCTION public.enforce_visa_disclaimer_core()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  core text := 'não jurídica e não garante a aprovação de vistos';
  normalized text;
BEGIN
  IF NEW.visa_disclaimer IS NULL OR btrim(NEW.visa_disclaimer) = '' THEN
    NEW.visa_disclaimer := E'A Viajaly presta consultoria de viagem, não jurídica e não garante a aprovação de vistos.\n\nA decisão final é sempre do consulado.';
  END IF;
  normalized := regexp_replace(lower(NEW.visa_disclaimer), '\s+', ' ', 'g');
  IF position(core IN normalized) = 0 THEN
    NEW.visa_disclaimer := NEW.visa_disclaimer || E'\n\nA Viajaly presta consultoria de viagem, não jurídica e não garante a aprovação de vistos.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_visa_disclaimer ON public.agencies;
CREATE TRIGGER trg_enforce_visa_disclaimer
  BEFORE INSERT OR UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_visa_disclaimer_core();

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS lead_message text,
  ADD COLUMN IF NOT EXISTS lead_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_consent_text text;

CREATE TABLE IF NOT EXISTS public.lead_submissions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  email text,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_submissions_log TO authenticated;
GRANT ALL ON public.lead_submissions_log TO service_role;
GRANT INSERT ON public.lead_submissions_log TO anon;
ALTER TABLE public.lead_submissions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_log_admin_read" ON public.lead_submissions_log;
CREATE POLICY "lead_log_admin_read" ON public.lead_submissions_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND agency_id = public.current_agency_id());

CREATE INDEX IF NOT EXISTS idx_lead_log_ip_time ON public.lead_submissions_log(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_lead_log_email_time ON public.lead_submissions_log(email, created_at);

CREATE OR REPLACE FUNCTION public.submit_lead(_payload jsonb, _client_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency uuid; _email text; _name text; _phone text; _message text;
  _consent boolean; _consent_text text; _honeypot text;
  _started_at_ms bigint; _now_ms bigint; _prod text;
  _req_id uuid; _code text; _try int := 0; _recent int;
BEGIN
  _honeypot := COALESCE(_payload->>'website', '');
  IF _honeypot <> '' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  _started_at_ms := COALESCE((_payload->>'started_at_ms')::bigint, 0);
  _now_ms := (extract(epoch from now()) * 1000)::bigint;
  IF _started_at_ms > 0 AND (_now_ms - _started_at_ms) < 3000 THEN
    RAISE EXCEPTION 'too_fast';
  END IF;

  _email := lower(btrim(COALESCE(_payload->>'email','')));
  _name  := btrim(COALESCE(_payload->>'name',''));
  _phone := btrim(COALESCE(_payload->>'phone',''));
  _message := NULLIF(btrim(COALESCE(_payload->>'message','')),'');
  _consent := COALESCE((_payload->>'consent')::boolean, false);
  _consent_text := NULLIF(btrim(COALESCE(_payload->>'consent_text','')),'');

  IF _email = '' OR _name = '' OR _phone = '' THEN
    RAISE EXCEPTION 'campos_obrigatorios';
  END IF;
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;
  IF NOT _consent THEN
    RAISE EXCEPTION 'consent_required';
  END IF;

  SELECT count(*) INTO _recent FROM public.lead_submissions_log
   WHERE ip = _client_ip AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RAISE EXCEPTION 'rate_limit_ip'; END IF;

  SELECT count(*) INTO _recent FROM public.lead_submissions_log
   WHERE email = _email AND created_at > now() - interval '1 hour';
  IF _recent >= 3 THEN RAISE EXCEPTION 'rate_limit_email'; END IF;

  SELECT id INTO _agency FROM public.agencies ORDER BY created_at LIMIT 1;
  IF _agency IS NULL THEN RAISE EXCEPTION 'no_agency'; END IF;

  LOOP
    _code := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.requests WHERE agency_id = _agency AND access_code = _code
    ) OR _try > 50;
    _try := _try + 1;
  END LOOP;

  INSERT INTO public.requests(
    agency_id, lead_name, lead_email, lead_phone, whatsapp_e164,
    access_code, proposal_status, lead_source, lead_message,
    lead_consent_at, lead_consent_text
  ) VALUES (
    _agency, _name, _email, _phone, _phone,
    _code, 'draft', 'public_form', _message,
    now(), _consent_text
  ) RETURNING id INTO _req_id;

  IF _payload ? 'products' THEN
    FOR _prod IN SELECT jsonb_array_elements_text(_payload->'products') LOOP
      IF _prod IN ('vistos','passaporte','roteiro','milhas') THEN
        INSERT INTO public.proposal_items(request_id, product_key, kind, label, qty, unit_price_cents, sort)
        VALUES (_req_id, _prod::public.product_key_t, 'principal', _prod, 1, 0, 0);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.lead_submissions_log(ip, email, agency_id) VALUES (_client_ip, _email, _agency);

  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_req_id, 'new_lead', 'Novo lead pelo formulário',
          _name || ' — ' || COALESCE(_message, 'sem mensagem'), 'admin');

  RETURN jsonb_build_object('ok', true, 'request_id', _req_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_lead(jsonb, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_agency_profile(_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _agency := public.current_agency_id();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no_agency'; END IF;

  UPDATE public.agencies SET
    name = COALESCE(NULLIF(btrim(_payload->>'name'),''), name),
    bio = COALESCE(_payload->>'bio', bio),
    logo_path = COALESCE(_payload->>'logo_path', logo_path),
    primary_color = COALESCE(NULLIF(btrim(_payload->>'primary_color'),''), primary_color),
    instagram = COALESCE(_payload->>'instagram', instagram),
    endereco = COALESCE(_payload->>'endereco', endereco),
    public_email = COALESCE(_payload->>'public_email', public_email),
    public_whatsapp = COALESCE(_payload->>'public_whatsapp', public_whatsapp),
    visa_disclaimer = COALESCE(NULLIF(btrim(_payload->>'visa_disclaimer'),''), visa_disclaimer)
  WHERE id = _agency;
END; $$;

CREATE OR REPLACE FUNCTION public.update_agency_billing(_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agency uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _agency := public.current_agency_id();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no_agency'; END IF;

  UPDATE public.agencies SET
    pix_key = COALESCE(NULLIF(btrim(_payload->>'pix_key'),''), pix_key),
    pix_key_type = COALESCE(NULLIF(btrim(_payload->>'pix_key_type'),''), pix_key_type),
    pix_merchant_name = COALESCE(NULLIF(btrim(_payload->>'pix_merchant_name'),''), pix_merchant_name),
    pix_merchant_city = COALESCE(NULLIF(btrim(_payload->>'pix_merchant_city'),''), pix_merchant_city)
  WHERE id = _agency;
END; $$;
