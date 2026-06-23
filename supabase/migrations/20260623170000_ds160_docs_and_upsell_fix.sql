-- =========================================================
-- FATIA 3 — DS-160: corrige upsell de passaporte + documentos default (RG/CNH, CPF)
-- =========================================================

-- 1) Bug #2: add_product_to_request consultava products_catalog.product_key (coluna inexistente).
--    A PK do catálogo é "key" (tipo product_key_t). Corrigido aqui.
CREATE OR REPLACE FUNCTION public.add_product_to_request(_request_id uuid, _traveler_id uuid, _product_key public.product_key_t)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _label text; _price int;
BEGIN
  IF NOT public.is_request_member(_request_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _traveler_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.travelers WHERE id = _traveler_id AND request_id = _request_id) THEN
      RAISE EXCEPTION 'traveler_not_in_request';
    END IF;
  END IF;
  SELECT name, ROUND(price * 100)::int INTO _label, _price
  FROM public.products_catalog WHERE key = _product_key AND active = true LIMIT 1;
  IF _price IS NULL THEN
    IF _product_key = 'pass' THEN _label := 'Assessoria de Passaporte'; _price := 39000;
    ELSE RAISE EXCEPTION 'product_not_in_catalog'; END IF;
  END IF;
  INSERT INTO public.proposal_items(request_id, product_key, kind, label, qty, unit_price_cents, discount_cents)
  VALUES (_request_id, _product_key, 'por_pessoa',
          _label || CASE WHEN _traveler_id IS NOT NULL THEN ' (upsell DS-160)' ELSE '' END,
          1, _price, 0);
  IF _product_key = 'pass' AND _traveler_id IS NOT NULL THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status)
    VALUES (_traveler_id, 'passaporte_pf', 25000, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  INSERT INTO public.notifications(request_id, kind, title, body, audience)
  VALUES (_request_id, 'product_upsell', 'Produto adicionado pelo cliente',
          'Upsell de ' || _product_key::text || ' via DS-160.', 'admin');
  RETURN jsonb_build_object('ok', true, 'product_key', _product_key, 'price_cents', _price);
END; $function$;

-- 2) Documentos default por viajante: incluir RG/CNH e CPF (Build Spec §10.3).
--    Usa kind 'outro' (enum doc_kind_t não tem rgcnh/cpf) — diferenciados pelo nome.
CREATE OR REPLACE FUNCTION public.create_traveler_defaults()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _has_vistos boolean; _has_pass boolean;
BEGIN
  INSERT INTO public.documents (traveler_id, kind, name, status, required) VALUES
    (NEW.id, 'pass',  'Passaporte atual',                  'pending', true),
    (NEW.id, 'foto',  'Foto 5x5 digital',                  'pending', true),
    (NEW.id, 'outro', 'RG ou CNH',                         'pending', true),
    (NEW.id, 'outro', 'CPF (se não constar no RG)',        'pending', false),
    (NEW.id, 'renda', 'Comprovante de renda',              'pending', true),
    (NEW.id, 'vinc',  'Comprovante de vínculo',            'pending', true),
    (NEW.id, 'ds160', 'Confirmação DS-160 (geramos pra você)', 'locked', true);

  INSERT INTO public.ds160_submission (traveler_id, form, completion_pct, status)
    VALUES (NEW.id, '{}'::jsonb, 0, 'draft')
    ON CONFLICT (traveler_id) DO NOTHING;

  INSERT INTO public.schedule_intents (traveler_id, service, status) VALUES
    (NEW.id, 'casv', 'open'), (NEW.id, 'entrevista', 'open'), (NEW.id, 'pf', 'open');

  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = NEW.request_id AND product_key = 'vistos') INTO _has_vistos;
  SELECT EXISTS(SELECT 1 FROM public.proposal_items WHERE request_id = NEW.request_id AND product_key = 'pass') INTO _has_pass;

  IF _has_vistos THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_usd_cents, amount_brl_cents, status)
    VALUES (NEW.id, 'consular_mrv', 18500, 0, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  IF _has_pass THEN
    INSERT INTO public.tax_payments(traveler_id, kind, amount_brl_cents, status)
    VALUES (NEW.id, 'passaporte_pf', 25000, 'pending')
    ON CONFLICT (traveler_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;
