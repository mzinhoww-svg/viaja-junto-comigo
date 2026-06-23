
-- 1A) Remove simulated card payment RPC (Stripe is the only path now)
DROP FUNCTION IF EXISTS public.pay_with_card(uuid, int, text, text);

-- 1B) Remove simulated lock_usd_rate (hardcoded 5.42); replaced by Edge Function
DROP FUNCTION IF EXISTS public.lock_usd_rate(uuid, boolean);
DROP FUNCTION IF EXISTS public.lock_usd_rate(uuid);

-- Applier called by the Edge Function (which fetched the real rate)
CREATE OR REPLACE FUNCTION public.apply_usd_rate(
  _request_id uuid,
  _rate numeric,
  _as_of timestamptz,
  _source text,
  _force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing numeric; _ex_as timestamptz; _ex_src text;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT usd_rate, usd_as_of, usd_source INTO _existing, _ex_as, _ex_src
    FROM public.requests WHERE id = _request_id;
  IF _existing IS NOT NULL AND NOT _force THEN
    RETURN jsonb_build_object('rate', _existing, 'as_of', _ex_as, 'source', _ex_src, 'cached', true);
  END IF;
  IF _rate IS NULL OR _rate <= 0 THEN RAISE EXCEPTION 'invalid_rate'; END IF;
  UPDATE public.requests
     SET usd_rate = _rate, usd_as_of = _as_of, usd_source = _source
   WHERE id = _request_id;
  UPDATE public.tax_payments tp
     SET amount_brl_cents = ROUND(tp.amount_usd_cents * _rate)::int, updated_at = now()
   FROM public.travelers t
   WHERE tp.traveler_id = t.id AND t.request_id = _request_id
     AND tp.kind = 'consular_mrv' AND tp.status = 'pending';
  RETURN jsonb_build_object('rate', _rate, 'as_of', _as_of, 'source', _source, 'cached', false);
END; $$;
GRANT EXECUTE ON FUNCTION public.apply_usd_rate(uuid, numeric, timestamptz, text, boolean) TO authenticated, service_role;

-- Cache read used by the Edge Function to decide cache hit
CREATE OR REPLACE FUNCTION public.get_usd_rate(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r numeric; _a timestamptz; _s text;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT usd_rate, usd_as_of, usd_source INTO _r, _a, _s
    FROM public.requests WHERE id = _request_id;
  RETURN jsonb_build_object('rate', _r, 'as_of', _a, 'source', _s);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_usd_rate(uuid) TO authenticated, service_role;

-- 1C) Agency-wide USD reference (updated daily by cron Edge Function)
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS usd_reference_rate numeric(10,4),
  ADD COLUMN IF NOT EXISTS usd_reference_at   timestamptz;
