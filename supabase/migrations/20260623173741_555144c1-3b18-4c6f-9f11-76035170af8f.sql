
-- 3A. Trilha jurídica da assinatura
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS body_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS signed_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS signed_cpf TEXT,
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;

CREATE OR REPLACE FUNCTION public.sign_contract_v2(
  _request_id UUID,
  _name TEXT,
  _body_html TEXT,
  _body_sha256 TEXT,
  _ip TEXT,
  _user_agent TEXT,
  _accepted BOOLEAN,
  _cpf TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.requests%ROWTYPE;
  _contract_id UUID;
  _now TIMESTAMPTZ := now();
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT COALESCE(_accepted, false) THEN RAISE EXCEPTION 'terms_not_accepted'; END IF;
  IF _body_sha256 IS NULL OR char_length(_body_sha256) <> 64 THEN RAISE EXCEPTION 'invalid_hash'; END IF;

  SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
  IF r.payment_status <> 'paid' THEN RAISE EXCEPTION 'payment_required'; END IF;
  IF r.contract_signed THEN RAISE EXCEPTION 'already signed'; END IF;
  IF char_length(btrim(coalesce(_name,''))) < 4 THEN RAISE EXCEPTION 'name_too_short'; END IF;

  -- prova de integridade: recomputar e comparar
  IF encode(digest(_body_html, 'sha256'), 'hex') <> lower(_body_sha256) THEN
    RAISE EXCEPTION 'hash_mismatch';
  END IF;

  INSERT INTO public.contracts(
    request_id, client, status, body_html, body_sha256,
    signed_name, signed_ip, signed_user_agent, signed_cpf,
    accepted_terms_at, signed_at
  )
  VALUES (
    _request_id, r.lead_name, 'signed', _body_html, lower(_body_sha256),
    btrim(_name), _ip, _user_agent, NULLIF(btrim(coalesce(_cpf,'')), ''),
    _now, _now
  )
  RETURNING id INTO _contract_id;

  UPDATE public.requests
     SET contract_signed = true,
         sign_name = btrim(_name),
         signed_at = _now,
         client_signature_ip = _ip
   WHERE id = _request_id;

  INSERT INTO public.audit_log(actor, action, target, payload)
  VALUES (
    auth.uid(),
    'contract_signed',
    _contract_id::text,
    jsonb_build_object(
      'request_id', _request_id,
      'ip', _ip,
      'user_agent', _user_agent,
      'body_sha256', lower(_body_sha256),
      'signer_name', btrim(_name),
      'signer_cpf', NULLIF(btrim(coalesce(_cpf,'')), ''),
      'accepted_terms_at', _now,
      'signed_at', _now
    )
  );

  RETURN jsonb_build_object(
    'contract_id', _contract_id,
    'signed_at', _now,
    'ip', _ip,
    'user_agent', _user_agent,
    'body_sha256', lower(_body_sha256)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.sign_contract_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- garante extensão pgcrypto para digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_contract_pdf_path(_contract_id UUID, _path TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _req UUID;
BEGIN
  SELECT request_id INTO _req FROM public.contracts WHERE id = _contract_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_request_member(_req) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _path IS NULL OR _path NOT LIKE ('contratos/' || _req::text || '/%') THEN
    RAISE EXCEPTION 'invalid_path';
  END IF;
  UPDATE public.contracts SET pdf_path = _path WHERE id = _contract_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_contract_pdf_path(UUID, TEXT) TO authenticated;

-- Storage policies para contratos/<request_id>/*
DROP POLICY IF EXISTS "contratos_member_read" ON storage.objects;
DROP POLICY IF EXISTS "contratos_member_write" ON storage.objects;

CREATE POLICY "contratos_member_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'contratos'
    AND public.is_request_member(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "contratos_member_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'contratos'
    AND public.is_request_member(((storage.foldername(name))[2])::uuid)
  );
