
CREATE OR REPLACE FUNCTION public.update_request_with_items(_request_id uuid, payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agency uuid;
  _trav jsonb;
  _item jsonb;
  _existing_id uuid;
  _kept uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT agency_id INTO _agency FROM public.requests WHERE id = _request_id;
  IF _agency IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _agency <> public.current_agency_id() THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Atualiza dados do lead
  UPDATE public.requests
     SET lead_name     = COALESCE(payload->>'lead_name', lead_name),
         lead_email    = COALESCE(lower(payload->>'lead_email'), lead_email),
         lead_phone    = COALESCE(payload->>'lead_phone', lead_phone),
         whatsapp_e164 = COALESCE(payload->>'whatsapp_e164', whatsapp_e164)
   WHERE id = _request_id;

  -- Substitui itens (totais recalculam via trigger)
  IF payload ? 'items' THEN
    DELETE FROM public.proposal_items WHERE request_id = _request_id;
    FOR _item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
      INSERT INTO public.proposal_items(
        request_id, product_key, kind, label, qty, unit_price_cents, discount_cents, sort
      ) VALUES (
        _request_id,
        NULLIF(_item->>'product_key','')::public.product_key_t,
        COALESCE(_item->>'kind','extra'),
        _item->>'label',
        COALESCE((_item->>'qty')::int, 1),
        COALESCE((_item->>'unit_price_cents')::int, 0),
        COALESCE((_item->>'discount_cents')::int, 0),
        COALESCE((_item->>'sort')::int, 0)
      );
    END LOOP;
  END IF;

  -- Atualiza/insere viajantes preservando os existentes pelo id (se vier)
  IF payload ? 'travelers' THEN
    FOR _trav IN SELECT * FROM jsonb_array_elements(payload->'travelers') LOOP
      _existing_id := NULLIF(_trav->>'id','')::uuid;
      IF _existing_id IS NOT NULL THEN
        UPDATE public.travelers
           SET name = COALESCE(_trav->>'name', name)
         WHERE id = _existing_id AND request_id = _request_id;
        _kept := array_append(_kept, _existing_id);
      ELSE
        INSERT INTO public.travelers(request_id, name)
        VALUES (_request_id, _trav->>'name')
        RETURNING id INTO _existing_id;
        _kept := array_append(_kept, _existing_id);
      END IF;
    END LOOP;
    -- Remove viajantes ausentes do payload SOMENTE se ainda não tiverem upload
    DELETE FROM public.travelers t
     WHERE t.request_id = _request_id
       AND t.id <> ALL(_kept)
       AND NOT EXISTS (
         SELECT 1 FROM public.documents d
         WHERE d.traveler_id = t.id AND d.file_url IS NOT NULL
       );
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.update_request_with_items(uuid, jsonb) TO authenticated;
