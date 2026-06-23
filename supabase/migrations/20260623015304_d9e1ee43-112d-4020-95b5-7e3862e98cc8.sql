
CREATE OR REPLACE FUNCTION public.request_code_resend(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _recent int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.requests WHERE id = _request_id) THEN
    RAISE EXCEPTION 'not found';
  END IF;

  SELECT count(*) INTO _recent
  FROM public.notifications
  WHERE request_id = _request_id
    AND kind = 'code_resend_requested'
    AND created_at > now() - interval '5 minutes';
  IF _recent > 0 THEN RAISE EXCEPTION 'cooldown'; END IF;

  INSERT INTO public.notifications(request_id, kind, title, body)
  VALUES (
    _request_id,
    'code_resend_requested',
    'Cliente pediu reenvio do código de acesso',
    'Solicitação iniciada pelo portal de login.'
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.request_code_resend(uuid) TO anon, authenticated;
