
CREATE OR REPLACE FUNCTION public.send_message(_request_id uuid, _body text, _attachments jsonb, _internal boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _is_admin boolean; _is_member boolean; _from public.msg_from_t;
BEGIN
  _is_admin := public.has_role(auth.uid(),'admin')
               AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = _request_id AND r.agency_id = public.current_agency_id());
  _is_member := public.is_request_member(_request_id);
  IF NOT (_is_admin OR _is_member) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(btrim(_body),'') = '' AND COALESCE(jsonb_array_length(_attachments),0) = 0 THEN
    RAISE EXCEPTION 'empty message';
  END IF;
  IF _internal AND NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  _from := CASE WHEN _is_admin THEN 'consultant'::public.msg_from_t ELSE 'client'::public.msg_from_t END;

  INSERT INTO public.messages(request_id, "from", text, attachments, internal)
  VALUES (_request_id, _from, btrim(_body), COALESCE(_attachments,'[]'::jsonb), COALESCE(_internal,false))
  RETURNING id INTO _id;

  IF NOT COALESCE(_internal,false) THEN
    INSERT INTO public.notifications(request_id, kind, title, body, audience)
    VALUES (_request_id, 'new_message',
            CASE WHEN _is_admin THEN 'Nova mensagem da Viajaly' ELSE 'Nova mensagem do cliente' END,
            LEFT(COALESCE(_body,''), 140),
            CASE WHEN _is_admin THEN 'client' ELSE 'admin' END);
  END IF;

  RETURN jsonb_build_object('id', _id);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_admin boolean;
BEGIN
  _is_admin := public.has_role(auth.uid(),'admin')
               AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = _request_id AND r.agency_id = public.current_agency_id());
  IF NOT (_is_admin OR public.is_request_member(_request_id)) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _is_admin THEN
    UPDATE public.messages SET read_at = now()
     WHERE request_id = _request_id AND read_at IS NULL
       AND internal = false AND "from" = 'client';
  ELSE
    UPDATE public.messages SET read_at = now()
     WHERE request_id = _request_id AND read_at IS NULL
       AND internal = false AND "from" = 'consultant';
  END IF;
END; $$;
