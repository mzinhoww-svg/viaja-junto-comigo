
-- =========================================================
-- Fase 8: Expiração + auditoria do código de acesso
-- =========================================================

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS access_code_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

ALTER TABLE public.access_code_attempts
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempted_code text;

CREATE INDEX IF NOT EXISTS access_code_attempts_request_idx
  ON public.access_code_attempts(request_id, at DESC);
CREATE INDEX IF NOT EXISTS access_code_attempts_ip_idx
  ON public.access_code_attempts(ip, at DESC);

-- Policy: admin pode ler tentativas da própria agência (via request_id ↔ agency)
CREATE POLICY "ac_attempts_admin_agency_read"
ON public.access_code_attempts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    request_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = access_code_attempts.request_id
        AND r.agency_id = public.current_agency_id()
    )
  )
);

-- RPC: admin gera novo código de 6 dígitos para a solicitação
CREATE OR REPLACE FUNCTION public.regenerate_access_code(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _agency uuid; _code text; _try int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  LOOP
    _code := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.requests
      WHERE agency_id = _agency AND access_code = _code
    ) OR _try > 50;
    _try := _try + 1;
  END LOOP;

  UPDATE public.requests
     SET access_code = _code,
         access_code_expires_at = now() + interval '30 days'
   WHERE id = _request_id;

  RETURN jsonb_build_object('access_code', _code, 'expires_at', now() + interval '30 days');
END; $$;

-- RPC: cliente pede reenvio (apenas registra notificação para admins)
CREATE OR REPLACE FUNCTION public.request_code_resend(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _agency uuid; _recent int;
BEGIN
  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  -- cooldown 5 minutos por request
  SELECT count(*) INTO _recent
  FROM public.notifications
  WHERE request_id = _request_id
    AND type = 'code_resend_requested'
    AND created_at > now() - interval '5 minutes';
  IF _recent > 0 THEN RAISE EXCEPTION 'cooldown'; END IF;

  INSERT INTO public.notifications(request_id, agency_id, type, payload, created_at)
  VALUES (_request_id, _agency, 'code_resend_requested',
          jsonb_build_object('source','portal_login'), now());
END; $$;

GRANT EXECUTE ON FUNCTION public.regenerate_access_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_code_resend(uuid) TO anon, authenticated;
