
ALTER TYPE public.proposal_status_t ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE public.proposal_status_t ADD VALUE IF NOT EXISTS 'declined';

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS proposal_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_total_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_e164 TEXT;

CREATE TABLE IF NOT EXISTS public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  product_key public.product_key_t REFERENCES public.products_catalog(key) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'extra',
  label TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposal_items_request_idx ON public.proposal_items(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO authenticated;
GRANT ALL ON public.proposal_items TO service_role;

ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read proposal items" ON public.proposal_items;
CREATE POLICY "members read proposal items"
  ON public.proposal_items FOR SELECT TO authenticated
  USING (public.is_request_member(request_id));

DROP POLICY IF EXISTS "admins write proposal items" ON public.proposal_items;
CREATE POLICY "admins write proposal items"
  ON public.proposal_items FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.agency_id = public.current_agency_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.agency_id = public.current_agency_id())
  );

CREATE OR REPLACE FUNCTION public.recompute_proposal_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req UUID := COALESCE(NEW.request_id, OLD.request_id);
  _sub INTEGER;
  _disc INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(qty * unit_price_cents), 0),
    COALESCE(SUM(discount_cents), 0)
  INTO _sub, _disc
  FROM public.proposal_items WHERE request_id = _req;

  UPDATE public.requests
     SET proposal_subtotal_cents = _sub,
         proposal_discount_cents = _disc,
         proposal_total_cents    = GREATEST(_sub - _disc, 0)
   WHERE id = _req;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_recompute_proposal_totals ON public.proposal_items;
CREATE TRIGGER trg_recompute_proposal_totals
AFTER INSERT OR UPDATE OR DELETE ON public.proposal_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_proposal_totals();

CREATE OR REPLACE FUNCTION public.create_request_with_travelers(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency UUID;
  _req_id UUID;
  _group_id UUID;
  _code TEXT;
  _try INTEGER := 0;
  _trav JSONB;
  _item JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  _agency := public.current_agency_id();
  IF _agency IS NULL THEN RAISE EXCEPTION 'no agency'; END IF;

  LOOP
    _code := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.requests WHERE agency_id = _agency AND access_code = _code
    ) OR _try > 50;
    _try := _try + 1;
  END LOOP;

  IF (payload->>'is_group')::boolean IS TRUE THEN
    INSERT INTO public.request_group(name) VALUES (COALESCE(payload->>'group_name','Grupo'))
    RETURNING id INTO _group_id;
  END IF;

  INSERT INTO public.requests(
    agency_id, lead_name, lead_email, lead_phone, whatsapp_e164,
    access_code, proposal_status, created_by
  ) VALUES (
    _agency,
    payload->>'lead_name',
    lower(payload->>'lead_email'),
    payload->>'lead_phone',
    payload->>'whatsapp_e164',
    _code,
    'draft',
    auth.uid()
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

  RETURN jsonb_build_object('request_id', _req_id, 'access_code', _code);
END; $$;

REVOKE ALL ON FUNCTION public.create_request_with_travelers(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_request_with_travelers(jsonb) TO authenticated;
