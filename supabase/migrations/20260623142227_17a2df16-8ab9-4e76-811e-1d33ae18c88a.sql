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
    VALUES (_traveler_id, COALESCE(_form,'{}'::jsonb), GREATEST(0, LEAST(100, COALESCE(_completion_pct,0))), 'draft'::public.ds160_status_t, now())
  ON CONFLICT (traveler_id) DO UPDATE
    SET form = EXCLUDED.form,
        completion_pct = EXCLUDED.completion_pct,
        updated_at = now(),
        status = CASE WHEN public.ds160_submission.status = 'validated'::public.ds160_status_t
                      THEN 'validated'::public.ds160_status_t
                      ELSE 'draft'::public.ds160_status_t END;
END; $$;