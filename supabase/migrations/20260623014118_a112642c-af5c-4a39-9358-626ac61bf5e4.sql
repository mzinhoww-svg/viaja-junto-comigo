
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS pix_merchant_name TEXT,
  ADD COLUMN IF NOT EXISTS pix_merchant_city TEXT;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS client_signature_ip TEXT;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS signed_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_ip TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Seed demo agency Pix info (idempotent)
UPDATE public.agencies
   SET pix_key = COALESCE(pix_key, 'contato@viajaly.app'),
       pix_key_type = COALESCE(pix_key_type, 'email'),
       pix_merchant_name = COALESCE(pix_merchant_name, 'VIAJALY CONSULTORIA'),
       pix_merchant_city = COALESCE(pix_merchant_city, 'SAO PAULO');

-- RPC: sign contract (client member)
CREATE OR REPLACE FUNCTION public.sign_contract(_request_id UUID, _name TEXT, _body_html TEXT, _ip TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.requests%ROWTYPE;
  _contract_id UUID;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
  IF r.proposal_status <> 'accepted' THEN
    RAISE EXCEPTION 'proposal not accepted';
  END IF;
  IF r.contract_signed THEN
    RAISE EXCEPTION 'already signed';
  END IF;
  IF coalesce(btrim(_name),'') = '' THEN
    RAISE EXCEPTION 'name required';
  END IF;

  INSERT INTO public.contracts(request_id, client, status, body_html, signed_name, signed_ip, signed_at)
    VALUES (_request_id, r.lead_name, 'signed', _body_html, _name, _ip, now())
  RETURNING id INTO _contract_id;

  UPDATE public.requests
     SET contract_signed = true,
         sign_name = _name,
         signed_at = now(),
         client_signature_ip = _ip,
         payment_amount_cents = r.proposal_total_cents,
         payment_method = COALESCE(payment_method, 'pix')
   WHERE id = _request_id;

  RETURN jsonb_build_object('contract_id', _contract_id);
END; $$;

-- RPC: confirm payment (admin only)
CREATE OR REPLACE FUNCTION public.confirm_payment(_request_id UUID, _paid BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
           payment_method = COALESCE(payment_method, 'pix')
     WHERE id = _request_id;
  ELSE
    UPDATE public.requests
       SET payment_status = 'pending',
           payment_paid_at = NULL,
           payment_confirmed_by = NULL
     WHERE id = _request_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.sign_contract(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, BOOLEAN) TO authenticated;
